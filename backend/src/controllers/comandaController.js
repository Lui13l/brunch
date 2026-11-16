const { Comanda, MenuItem } = require("../models");
const { HttpError } = require("../utils/http");
const { toComanda } = require("../utils/serializar");
const { conTransaccion } = require("../utils/transaccion");
const { codigoCorto } = require("../utils/codigo");
const { ROL } = require("../utils/roles");
const { redondear2, pesos } = require("../utils/dinero");
const { arqueoAbierto, publicarCaja } = require("../services/caja");
const { registrar, SERVICIO } = require("../services/auditoria");
const {
  mismo,
  cargar,
  reclamarMesas,
  exigirAbierta,
  diagnosticarItem,
  calcularTotal,
  enviar,
  devolverConsumos,
  avisarSiLaMesaEstaCompleta,
} = require("../services/comandas");
const { avisarInventario } = require("../services/inventario");
const { publicar, TOPICS } = require("../ws/hub");

// Cuentas de las mesas (app del personal). Las reglas de negocio viven en
// services/comandas.js; aquí solo se traduce HTTP ↔ servicio y se avisa.

const { EN_COCINA } = Comanda;
const NO_EDITABLE = () => "El plato ya se envió a cocina: cancélalo en vez de modificarlo";

const responder = async (res, id) => res.json(toComanda(await cargar(id)));

// "mesa 4" o "mesas 4 + 5 + 6", para los mensajes y la auditoría.
const nombreDeMesas = (json) =>
  json.mesasExtra.length > 0
    ? `mesas ${[json.mesaNumero, ...json.mesasExtra.map((m) => m.numero)].join(" + ")}`
    : `mesa ${json.mesaNumero}`;

const abrir = async (req, res) => {
  const { mesaId, mesasExtra, comensales, notas } = req.valid.body;
  const extras = [...new Set(mesasExtra)].filter((id) => id !== mesaId);

  let creada;
  try {
    creada = await conTransaccion(async (session) => {
      await reclamarMesas(session, [mesaId, ...extras]);
      const [comanda] = await Comanda.create(
        [{ mesa_id: mesaId, mesas_extra: extras, mesero_id: req.usuario._id, comensales: comensales ?? null, notas }],
        { session }
      );
      return comanda;
    });
  } catch (err) {
    // Red de seguridad: el índice único parcial de mesa_id.
    if (err.code === 11000) throw new HttpError(409, "Esa mesa ya tiene una cuenta abierta");
    throw err;
  }
  const json = toComanda(await cargar(creada._id));
  publicar(TOPICS.salon, json);
  if (extras.length > 0) {
    await registrar(req.usuario, "AGRUPAR_MESAS", `Abrió una cuenta para las ${nombreDeMesas(json)}`, SERVICIO.COMANDAS);
  }
  res.json(json);
};

// Junta mesas a una cuenta abierta o las suelta: `mesasExtra` reemplaza la
// lista entera. La mesa principal no cambia.
const cambiarMesas = async (req, res) => {
  const { id } = req.valid.params;
  const comanda = await cargar(id);
  exigirAbierta(comanda);
  const principal = String(comanda.mesa_id?._id ?? comanda.mesa_id);
  const extras = [...new Set(req.valid.body.mesasExtra)].filter((m) => m !== principal);

  await conTransaccion(async (session) => {
    if (extras.length > 0) await reclamarMesas(session, extras, comanda._id);
    const r = await Comanda.updateOne({ _id: id, estado: "ABIERTA" }, { $set: { mesas_extra: extras } }, { session });
    if (r.matchedCount === 0) exigirAbierta(await cargar(id));
  });

  const json = toComanda(await cargar(id));
  publicar(TOPICS.salon, json);
  publicar(TOPICS.cocina, json);
  await registrar(
    req.usuario,
    "AGRUPAR_MESAS",
    extras.length > 0
      ? `La comanda ${codigoCorto(id)} ahora ocupa las ${nombreDeMesas(json)}`
      : `La comanda ${codigoCorto(id)} volvió a ocupar solo la mesa ${json.mesaNumero}`,
    SERVICIO.COMANDAS
  );
  res.json(json);
};

const listar = async (req, res) => {
  const filtro = { estado: "ABIERTA" };
  if (req.query.mias === "true") filtro.mesero_id = req.usuario._id;
  const comandas = await Comanda.find(filtro)
    .populate("mesa_id", "numero")
    .populate("mesas_extra", "numero")
    .sort({ fecha_apertura: 1 })
    .lean();
  res.json(comandas.map(toComanda));
};

const detalle = (req, res) => responder(res, req.valid.params.id);

const agregarItem = async (req, res) => {
  const { id } = req.valid.params;
  const { menuItemId, cantidad, notas } = req.valid.body;
  exigirAbierta(await cargar(id));

  const plato = await MenuItem.findById(menuItemId).lean();
  if (!plato) throw new HttpError(404, "Producto no encontrado");
  if (!plato.activo || plato.visible_salon === false) {
    throw new HttpError(409, `"${plato.nombre}" no está disponible en el salón`);
  }
  const precio = plato.precio ?? 0;

  // Tocar el mismo plato varias veces es "tres huevos", no tres renglones. Se
  // agrupa solo si coinciden plato, notas y precio: otra nota es otro plato.
  const sumado = await Comanda.updateOne(
    {
      _id: id,
      estado: "ABIERTA",
      items: {
        $elemMatch: {
          menu_item_id: plato._id,
          estado: "BORRADOR",
          notas: notas ?? null,
          precio_unitario: precio,
          cantidad: { $lte: 99 - cantidad },
        },
      },
    },
    { $inc: { "items.$.cantidad": cantidad } }
  );

  if (sumado.modifiedCount === 0) {
    // Nombre y precio se congelan aquí: cambiar la carta mañana no reescribe esta venta.
    const nuevo = await Comanda.updateOne(
      { _id: id, estado: "ABIERTA" },
      {
        $push: {
          items: { menu_item_id: plato._id, nombre_item: plato.nombre, precio_unitario: precio, cantidad, notas: notas ?? null },
        },
      }
    );
    if (nuevo.modifiedCount === 0) exigirAbierta(await cargar(id));
  }
  await responder(res, id);
};

const editarItem = async (req, res) => {
  const { id, itemId } = req.valid.params;
  const set = { "items.$.cantidad": req.valid.body.cantidad };
  // Solo se tocan las notas si vienen: omitirlas no debe borrarlas.
  if (req.body && Object.hasOwn(req.body, "notas")) set["items.$.notas"] = req.valid.body.notas;

  const r = await Comanda.updateOne(
    { _id: id, estado: "ABIERTA", items: { $elemMatch: { _id: itemId, estado: "BORRADOR" } } },
    { $set: set }
  );
  if (r.matchedCount === 0) await diagnosticarItem(id, itemId, { porEstado: NO_EDITABLE });
  await responder(res, id);
};

const quitarItem = async (req, res) => {
  const { id, itemId } = req.valid.params;
  const r = await Comanda.updateOne(
    { _id: id, estado: "ABIERTA", items: { $elemMatch: { _id: itemId, estado: "BORRADOR" } } },
    { $pull: { items: { _id: itemId } } }
  );
  if (r.modifiedCount === 0) await diagnosticarItem(id, itemId, { porEstado: NO_EDITABLE });
  await responder(res, id);
};

const enviarACocina = async (req, res) => {
  const { id } = req.valid.params;
  exigirAbierta(await cargar(id));

  const { faltantes, sinReceta } = await conTransaccion((session) =>
    enviar(session, { comandaId: id, usuarioId: req.usuario._id })
  );

  // Fuera de la transacción: si algo revierte, nadie debe haber sido avisado.
  const json = toComanda(await cargar(id));
  publicar(TOPICS.cocina, json);
  if (faltantes.length > 0) publicar(TOPICS.adminInventario, { comandaId: json.id, faltantes });
  avisarInventario();
  await registrar(
    req.usuario,
    "ENVIAR_COCINA",
    `Envió a cocina la comanda ${codigoCorto(id)} (mesa ${json.mesaNumero})${faltantes.length ? " con faltantes" : ""}`,
    SERVICIO.COMANDAS
  );
  res.json({ comanda: json, faltantes, sinReceta });
};

// Cancela un plato ya enviado y devuelve lo que consumió.
const cancelarItem = async (req, res) => {
  const { id, itemId } = req.valid.params;
  exigirAbierta(await cargar(id));

  await conTransaccion(async (session) => {
    const antes = await Comanda.findOneAndUpdate(
      { _id: id, estado: "ABIERTA", items: { $elemMatch: { _id: itemId, estado: { $in: EN_COCINA } } } },
      { $set: { "items.$.estado": "CANCELADO", "items.$.inventario_aplicado": false } },
      { session, returnDocument: "before" }
    ).lean();

    if (!antes) {
      await diagnosticarItem(id, itemId, {
        session,
        porEstado: (item) => `No se puede cancelar un plato que ya está ${item.estado.toLowerCase()}`,
      });
    }

    const item = antes.items.find((i) => mismo(i._id, itemId));
    if (!item.inventario_aplicado) return;
    await devolverConsumos(session, {
      comandaId: antes._id,
      itemIds: [item._id],
      usuarioId: req.usuario._id,
      motivo: `Cancelación en comanda ${codigoCorto(id)}`,
    });
  });

  const comanda = await cargar(id);
  const json = toComanda(comanda);
  publicar(TOPICS.cocina, json);
  avisarInventario();
  // Cancelar el último plato pendiente también deja la mesa lista para llevar.
  avisarSiLaMesaEstaCompleta(comanda);
  await registrar(req.usuario, "CANCELAR_PLATO", `Canceló un plato de la comanda ${codigoCorto(id)}`, SERVICIO.COMANDAS);
  res.json(json);
};

const entregarItem = async (req, res) => {
  const { id, itemId } = req.valid.params;
  const r = await Comanda.updateOne(
    { _id: id, items: { $elemMatch: { _id: itemId, estado: "LISTO" } } },
    { $set: { "items.$.estado": "ENTREGADO" } }
  );
  if (r.matchedCount === 0) {
    const comanda = await cargar(id);
    if (!comanda.items.some((i) => mismo(i._id, itemId))) {
      throw new HttpError(404, "Plato no encontrado en esta comanda");
    }
    throw new HttpError(409, "Solo se puede entregar un plato que la cocina ya marcó como listo");
  }
  await responder(res, id);
};

/**
 * Cierra la cuenta. Se permite aunque no haya caja abierta (queda sin arqueo y
 * el reporte lo cuenta aparte). Si un admin fuerza el cierre con platos aún en
 * cocina, esos platos se cancelan y devuelven su inventario: no se cobran ni
 * quedan como tickets en la pantalla de cocina.
 */
const cerrar = async (req, res) => {
  const { id } = req.valid.params;
  const { metodoPago, pagos: partes, forzar } = req.valid.body;

  const { total, pagos, sinCaja, cancelados } = await conTransaccion(async (session) => {
    const comanda = await Comanda.findById(id).session(session).lean();
    if (!comanda) throw new HttpError(404, "Comanda no encontrada");
    exigirAbierta(comanda);

    const enBorrador = comanda.items.filter((i) => i.estado === "BORRADOR").length;
    if (enBorrador > 0) throw new HttpError(409, `Hay ${enBorrador} plato(s) sin enviar a cocina`);
    const enCocina = comanda.items.filter((i) => EN_COCINA.includes(i.estado));
    if (enCocina.length > 0 && !(forzar && req.usuario.rol_id === ROL.ADMIN)) {
      throw new HttpError(409, `Todavía hay ${enCocina.length} plato(s) en cocina`);
    }

    if (enCocina.length > 0) {
      await devolverConsumos(session, {
        comandaId: comanda._id,
        itemIds: enCocina.filter((i) => i.inventario_aplicado).map((i) => i._id),
        usuarioId: req.usuario._id,
        motivo: `Cierre forzado de la comanda ${codigoCorto(id)}`,
      });
    }

    const items = comanda.items.map((i) => (EN_COCINA.includes(i.estado) ? { ...i, estado: "CANCELADO" } : i));
    const total = calcularTotal(items);

    // Los montos de una cuenta dividida vienen de la app: solo valen si suman
    // exactamente el total que calcula el servidor.
    const pagos = partes ?? [{ metodo: metodoPago, monto: total, etiqueta: null }];
    const pagado = redondear2(pagos.reduce((suma, p) => suma + p.monto, 0));
    if (pagado !== redondear2(total)) {
      throw new HttpError(400, `Los pagos suman ${pesos(pagado)} y la cuenta es de ${pesos(total)}`);
    }
    const metodos = [...new Set(pagos.map((p) => p.metodo))];

    const arqueo = await arqueoAbierto(session).select("_id").lean();
    const r = await Comanda.updateOne(
      { _id: id, estado: "ABIERTA" },
      {
        $set: {
          estado: "CERRADA",
          metodo_pago: metodos.length === 1 ? metodos[0] : Comanda.PAGO_MIXTO,
          pagos,
          total,
          fecha_cierre: new Date(),
          arqueo_id: arqueo?._id ?? null,
          "items.$[c].estado": "CANCELADO",
          "items.$[c].inventario_aplicado": false,
        },
      },
      { arrayFilters: [{ "c.estado": { $in: EN_COCINA } }], session }
    );
    if (r.modifiedCount === 0) throw new HttpError(409, "La comanda ya está cerrada");
    return { total, pagos, sinCaja: !arqueo, cancelados: enCocina.length };
  });

  const comoPago =
    pagos.length === 1
      ? `en ${pagos[0].metodo}`
      : `dividida en ${pagos.length} pagos (${pagos.map((p) => `${p.metodo} ${pesos(p.monto)}`).join(", ")})`;

  const json = toComanda(await cargar(id));
  publicar(TOPICS.salon, json);
  if (cancelados > 0) {
    publicar(TOPICS.cocina, json);
    avisarInventario();
  }
  // El cobro cambia lo esperado en caja: se avisa para que el arqueo se actualice.
  publicarCaja();
  await registrar(
    req.usuario,
    "CERRAR_COMANDA",
    `Cerró la comanda ${codigoCorto(id)} (${nombreDeMesas(json)}) por ${total} ${comoPago}` +
      `${cancelados ? ` cancelando ${cancelados} plato(s) en cocina` : ""}${sinCaja ? " (sin caja abierta)" : ""}`,
    SERVICIO.COMANDAS
  );
  res.json(json);
};

// Cierra una cuenta sin cobrar: la mesa se abrió por error o el cliente se fue
// antes de pedir. Solo vale si no se ha servido nada: lo que quede en borrador
// se descarta, y lo ya enviado a cocina debe estar cancelado.
const anular = async (req, res) => {
  const { id } = req.valid.params;
  const comanda = await cargar(id);
  exigirAbierta(comanda);
  const servidos = comanda.items.filter((i) => !["BORRADOR", "CANCELADO"].includes(i.estado)).length;
  if (servidos > 0) {
    throw new HttpError(409, `La cuenta tiene ${servidos} plato(s) enviados: cóbrala o cancélalos antes de cerrarla`);
  }

  const r = await Comanda.updateOne(
    { _id: id, estado: "ABIERTA", "items.estado": { $nin: ["PENDIENTE", "PREPARANDO", "LISTO", "ENTREGADO"] } },
    { $set: { estado: "ANULADA", total: 0, fecha_cierre: new Date() }, $pull: { items: { estado: "BORRADOR" } } }
  );
  if (r.modifiedCount === 0) throw new HttpError(409, "La cuenta cambió mientras tanto. Vuelve a intentarlo.");

  const json = toComanda(await cargar(id));
  publicar(TOPICS.salon, json);
  await registrar(req.usuario, "ANULAR_COMANDA", `Cerró sin cobrar la comanda ${codigoCorto(id)} (${nombreDeMesas(json)})`, SERVICIO.COMANDAS);
  res.json(json);
};

module.exports = {
  abrir,
  anular,
  cambiarMesas,
  listar,
  detalle,
  agregarItem,
  editarItem,
  quitarItem,
  enviarACocina,
  cancelarItem,
  entregarItem,
  cerrar,
};
