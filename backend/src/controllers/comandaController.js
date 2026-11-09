const { Comanda, Mesa, MenuItem } = require("../models");
const { HttpError } = require("../utils/http");
const { toComanda } = require("../utils/serializar");
const { conTransaccion } = require("../utils/transaccion");
const { codigoCorto } = require("../utils/codigo");
const { ROL } = require("../utils/roles");
const { arqueoAbierto, publicarCaja } = require("../services/caja");
const { registrar, SERVICIO } = require("../services/auditoria");
const {
  mismo,
  cargar,
  exigirAbierta,
  diagnosticarItem,
  calcularTotal,
  enviar,
  devolverConsumos,
  avisarSiLaMesaEstaCompleta,
} = require("../services/comandas");
const { publicar, TOPICS } = require("../ws/hub");

// Cuentas de las mesas (app del personal). Las reglas de negocio viven en
// services/comandas.js; aquí solo se traduce HTTP ↔ servicio y se avisa.

const { EN_COCINA } = Comanda;
const NO_EDITABLE = () => "El plato ya se envió a cocina: cancélalo en vez de modificarlo";

const responder = async (res, id) => res.json(toComanda(await cargar(id)));

const abrir = async (req, res) => {
  const { mesaId, comensales, notas } = req.valid.body;
  const mesa = await Mesa.findById(mesaId).lean();
  if (!mesa) throw new HttpError(404, "Mesa no encontrada");
  if (!mesa.activa) throw new HttpError(409, `La mesa ${mesa.numero} está fuera de servicio`);

  let creada;
  try {
    creada = await Comanda.create({ mesa_id: mesa._id, mesero_id: req.usuario._id, comensales: comensales ?? null, notas });
  } catch (err) {
    // Lo impide un índice único parcial: si dos meseros abren la misma mesa a la vez, uno llega aquí.
    if (err.code === 11000) throw new HttpError(409, `La mesa ${mesa.numero} ya tiene una cuenta abierta`);
    throw err;
  }
  const json = toComanda(await cargar(creada._id));
  publicar(TOPICS.salon, json);
  res.json(json);
};

const listar = async (req, res) => {
  const filtro = { estado: "ABIERTA" };
  if (req.query.mias === "true") filtro.mesero_id = req.usuario._id;
  const comandas = await Comanda.find(filtro).populate("mesa_id", "numero").sort({ fecha_apertura: 1 }).lean();
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
  const { metodoPago, forzar } = req.valid.body;

  const { total, sinCaja, cancelados } = await conTransaccion(async (session) => {
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
    const arqueo = await arqueoAbierto(session).select("_id").lean();
    const r = await Comanda.updateOne(
      { _id: id, estado: "ABIERTA" },
      {
        $set: {
          estado: "CERRADA",
          metodo_pago: metodoPago,
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
    return { total, sinCaja: !arqueo, cancelados: enCocina.length };
  });

  const json = toComanda(await cargar(id));
  publicar(TOPICS.salon, json);
  if (cancelados > 0) publicar(TOPICS.cocina, json);
  // El cobro cambia lo esperado en caja: se avisa para que el arqueo se actualice.
  publicarCaja();
  await registrar(
    req.usuario,
    "CERRAR_COMANDA",
    `Cerró la comanda ${codigoCorto(id)} (mesa ${json.mesaNumero}) por ${total} en ${metodoPago}` +
      `${cancelados ? ` cancelando ${cancelados} plato(s) en cocina` : ""}${sinCaja ? " (sin caja abierta)" : ""}`,
    SERVICIO.COMANDAS
  );
  res.json(json);
};

module.exports = {
  abrir,
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
