const mongoose = require("mongoose");
const { z } = require("zod");
const { Comanda, Mesa, MenuItem, RecetaItem, MovimientoInventario } = require("../models");
const { HttpError } = require("../utils/http");
const { objectId, textoOpcional } = require("../utils/validar");
const { toComanda, toComandaItem, totalDeItems } = require("../utils/serializar");
const { conTransaccion } = require("../utils/transaccion");
const { redondear2, redondear3 } = require("../utils/dinero");
const { aplicarMovimiento, ordenarPorInsumo } = require("../services/inventario");
const { arqueoAbierto, publicarCaja } = require("../services/caja");
const { registrar, SERVICIO } = require("../services/auditoria");
const { publicar, TOPICS } = require("../ws/hub");

const { EN_COCINA, METODOS_PAGO } = Comanda;

// --- Esquemas (mismos mensajes que la API anterior) ---

const abrirSchema = z.object({
  mesaId: objectId,
  comensales: z.coerce
    .number({ error: "El número de comensales debe ser un número" })
    .int("El número de comensales debe ser entero")
    .min(1, "Debe haber al menos 1 comensal")
    .max(100, "Demasiados comensales para una sola mesa")
    .nullish(),
  notas: textoOpcional("Las notas"),
});

const cantidadPlato = z.coerce
  .number({ error: "La cantidad es obligatoria" })
  .int("La cantidad debe ser un número entero")
  .min(1, "La cantidad mínima es 1")
  .max(99, "Cantidad demasiado alta para un solo plato");

const agregarItemSchema = z.object({
  menuItemId: objectId,
  cantidad: cantidadPlato.default(1),
  notas: textoOpcional("Las notas"),
});

const editarItemSchema = z.object({ cantidad: cantidadPlato, notas: textoOpcional("Las notas") });

const cerrarSchema = z.object({
  metodoPago: z.enum(METODOS_PAGO, { error: "El método de pago debe ser EFECTIVO, TARJETA o TRANSFERENCIA" }),
  // Salida de emergencia para el admin: cerrar aunque queden platos en cocina.
  forzar: z.boolean().default(false),
});

const estadoCocinaSchema = z.object({
  estado: z.enum(["PREPARANDO", "LISTO"], { error: "La cocina solo puede marcar PREPARANDO o LISTO" }),
});

const itemParams = z.object({ id: objectId, itemId: objectId });

// --- Utilidades ---

const codigo = (id) => String(id).slice(-6).toUpperCase();
const mismo = (a, b) => String(a) === String(b);

const cargar = async (id) => {
  const comanda = await Comanda.findById(id).populate("mesa_id", "numero").lean();
  if (!comanda) throw new HttpError(404, "Comanda no encontrada");
  return comanda;
};

const exigirAbierta = (comanda) => {
  if (comanda.estado !== "ABIERTA") throw new HttpError(409, `La comanda ya está ${comanda.estado.toLowerCase()}`);
};

// Cuando una actualización condicional no encontró nada, explica por qué con
// el mismo mensaje que daba la API anterior.
const diagnosticarItem = async (id, itemId, { session, porEstado } = {}) => {
  const comanda = await Comanda.findById(id).session(session || null).lean();
  if (!comanda) throw new HttpError(404, "Comanda no encontrada");
  exigirAbierta(comanda);
  const item = comanda.items.find((i) => mismo(i._id, itemId));
  if (!item) throw new HttpError(404, "Plato no encontrado en esta comanda");
  throw new HttpError(409, porEstado(item));
};

const NO_EDITABLE = () => "El plato ya se envió a cocina: cancélalo en vez de modificarlo";

const responder = async (res, id) => res.json(toComanda(await cargar(id)));

// Cuando el último plato de una mesa sale de cocina, el mesero puede llevarlo
// todo de una vez. Los borradores no cuentan: la cocina ya terminó lo enviado.
const avisarSiLaMesaEstaCompleta = (comanda) => {
  const enCocina = comanda.items.filter((i) => EN_COCINA.includes(i.estado)).length;
  const listos = comanda.items.filter((i) => i.estado === "LISTO").length;
  if (enCocina > 0 || listos === 0) return;
  const aviso = {
    tipo: "mesaCompleta",
    comandaId: String(comanda._id),
    mesa: comanda.mesa_id?.numero ?? null,
    platos: listos,
  };
  publicar(TOPICS.mesero(comanda.mesero_id), aviso);
  publicar(TOPICS.salon, aviso);
};

// --- Comandas ---

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
          items: {
            menu_item_id: plato._id,
            nombre_item: plato.nombre,
            precio_unitario: precio,
            cantidad,
            notas: notas ?? null,
          },
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
  // Solo se tocan las notas si vienen: antes, omitirlas las borraba.
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

/**
 * Envía a cocina los platos en borrador y descuenta el inventario.
 *
 * Todo ocurre en una transacción: marcar los platos es la puerta de entrada (si
 * otra petición los marcó primero, esta no encuentra nada que enviar y no
 * descuenta dos veces). Si el stock no alcanza NO se bloquea el envío: queda
 * negativo, el plato y la comanda se marcan con faltante y se avisa a admin.
 */
const enviarACocina = async (req, res) => {
  const { id } = req.valid.params;
  exigirAbierta(await cargar(id));

  const { faltantes, sinReceta } = await conTransaccion(async (session) => {
    const lote = new mongoose.Types.ObjectId();
    const comanda = await Comanda.findOneAndUpdate(
      { _id: id, estado: "ABIERTA", "items.estado": "BORRADOR" },
      {
        $set: {
          "items.$[b].estado": "PENDIENTE",
          "items.$[b].fecha_envio": new Date(),
          "items.$[b].inventario_aplicado": true,
          "items.$[b].lote_envio": lote,
        },
      },
      { arrayFilters: [{ "b.estado": "BORRADOR" }], session, returnDocument: "after" }
    ).lean();

    if (!comanda) {
      const actual = await Comanda.findById(id).session(session).lean();
      if (actual) exigirAbierta(actual);
      throw new HttpError(409, "No hay platos nuevos que enviar");
    }

    const items = comanda.items.filter((i) => mismo(i.lote_envio, lote));
    const menuIds = [...new Set(items.map((i) => i.menu_item_id).filter(Boolean).map(String))];
    const recetas = await RecetaItem.find({ menu_item_id: { $in: menuIds } }).session(session).lean();

    const consumos = [];
    for (const item of items) {
      for (const linea of recetas.filter((r) => mismo(r.menu_item_id, item.menu_item_id))) {
        consumos.push({
          insumoId: linea.insumo_id,
          comandaItemId: item._id,
          cantidad: redondear3(linea.cantidad * item.cantidad),
        });
      }
    }

    const faltantesPorInsumo = new Map();
    const itemsConFaltante = new Set();
    for (const consumo of ordenarPorInsumo(consumos)) {
      const insumo = await aplicarMovimiento(session, {
        insumoId: consumo.insumoId,
        tipo: "CONSUMO",
        cantidad: -consumo.cantidad,
        motivo: `Comanda #${codigo(id)}`,
        comandaId: comanda._id,
        comandaItemId: consumo.comandaItemId,
        usuarioId: req.usuario._id,
      });
      if (insumo.stock < 0) {
        faltantesPorInsumo.set(String(insumo._id), { insumo: insumo.nombre, unidad: insumo.unidad, stock: insumo.stock });
        itemsConFaltante.add(String(consumo.comandaItemId));
      }
    }

    if (itemsConFaltante.size > 0) {
      await Comanda.updateOne(
        { _id: id },
        { $set: { tiene_faltante: true, "items.$[f].falto_stock": true } },
        {
          arrayFilters: [{ "f._id": { $in: [...itemsConFaltante].map((x) => new mongoose.Types.ObjectId(x)) } }],
          session,
        }
      );
    }

    const conReceta = new Set(recetas.map((r) => String(r.menu_item_id)));
    const sinReceta = [...new Set(items.filter((i) => !conReceta.has(String(i.menu_item_id))).map((i) => i.nombre_item))];
    return { faltantes: [...faltantesPorInsumo.values()], sinReceta };
  });

  // Fuera de la transacción: si algo revierte, nadie debe haber sido avisado.
  const comanda = await cargar(id);
  const json = toComanda(comanda);
  publicar(TOPICS.cocina, json);
  if (faltantes.length > 0) publicar(TOPICS.adminInventario, { comandaId: json.id, faltantes });
  await registrar(
    req.usuario,
    "ENVIAR_COCINA",
    `Envió a cocina la comanda #${codigo(id)} (mesa ${json.mesaNumero})${faltantes.length ? " con faltantes" : ""}`,
    SERVICIO.COMANDAS
  );
  res.json({ comanda: json, faltantes, sinReceta });
};

/**
 * Cancela un plato ya enviado y devuelve lo que consumió. La devolución sale de
 * los movimientos que realmente se registraron, no de la receta actual.
 */
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

    const consumos = await MovimientoInventario.find({ comanda_item_id: item._id, tipo: "CONSUMO" })
      .session(session)
      .lean();
    for (const mov of ordenarPorInsumo(consumos.map((c) => ({ ...c, insumoId: c.insumo_id })))) {
      await aplicarMovimiento(session, {
        insumoId: mov.insumo_id,
        tipo: "DEVOLUCION",
        cantidad: -mov.cantidad,
        motivo: `Cancelación en comanda #${codigo(id)}`,
        comandaId: antes._id,
        comandaItemId: item._id,
        usuarioId: req.usuario._id,
      });
    }
  });

  const comanda = await cargar(id);
  const json = toComanda(comanda);
  publicar(TOPICS.cocina, json);
  // Cancelar el último plato pendiente también deja la mesa lista para llevar.
  avisarSiLaMesaEstaCompleta(comanda);
  await registrar(req.usuario, "CANCELAR_PLATO", `Canceló un plato de la comanda #${codigo(id)}`, SERVICIO.COMANDAS);
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

// Cierra la cuenta. Se permite aunque no haya caja abierta (como antes): queda
// sin arqueo y el reporte de ventas lo cuenta aparte.
const cerrar = async (req, res) => {
  const { id } = req.valid.params;
  const { metodoPago, forzar } = req.valid.body;

  const { total, sinCaja } = await conTransaccion(async (session) => {
    const comanda = await Comanda.findById(id).session(session).lean();
    if (!comanda) throw new HttpError(404, "Comanda no encontrada");
    exigirAbierta(comanda);

    const enBorrador = comanda.items.filter((i) => i.estado === "BORRADOR").length;
    if (enBorrador > 0) throw new HttpError(409, `Hay ${enBorrador} plato(s) sin enviar a cocina`);
    const enCocina = comanda.items.filter((i) => EN_COCINA.includes(i.estado)).length;
    if (enCocina > 0 && !(forzar && req.usuario.rol_id === "admin")) {
      throw new HttpError(409, `Todavía hay ${enCocina} plato(s) en cocina`);
    }

    const total = redondear2(totalDeItems(comanda.items.map(toComandaItem)));
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
        },
      },
      { session }
    );
    if (r.modifiedCount === 0) throw new HttpError(409, "La comanda ya está cerrada");
    return { total, sinCaja: !arqueo };
  });

  const json = toComanda(await cargar(id));
  publicar(TOPICS.salon, json);
  // El cobro cambia lo esperado en caja: se avisa para que el arqueo se actualice.
  publicarCaja();
  await registrar(
    req.usuario,
    "CERRAR_COMANDA",
    `Cerró la comanda #${codigo(id)} (mesa ${json.mesaNumero}) por ${total} en ${metodoPago}${sinCaja ? " (sin caja abierta)" : ""}`,
    SERVICIO.COMANDAS
  );
  res.json(json);
};

// --- Cocina ---

const platoDeCocina = (comanda, item) => ({
  ...toComandaItem(item),
  comandaId: String(comanda._id),
  mesa: comanda.mesa_id?.numero ?? null,
});

const colaCocina = async (req, res) => {
  const comandas = await Comanda.find({ "items.estado": { $in: EN_COCINA } }).populate("mesa_id", "numero").lean();
  const platos = comandas.flatMap((c) => c.items.filter((i) => EN_COCINA.includes(i.estado)).map((i) => ({ c, i })));
  platos.sort((a, b) => new Date(a.i.fecha_envio) - new Date(b.i.fecha_envio));
  res.json(platos.map(({ c, i }) => platoDeCocina(c, i)));
};

const cambiarEstadoCocina = async (req, res) => {
  const itemId = req.valid.params.id;
  const { estado } = req.valid.body;

  const comanda = await Comanda.findOneAndUpdate(
    { items: { $elemMatch: { _id: itemId, estado: { $in: EN_COCINA } } } },
    { $set: { "items.$.estado": estado, "items.$.fecha_listo": estado === "LISTO" ? new Date() : null } },
    { returnDocument: "after" }
  )
    .populate("mesa_id", "numero")
    .lean();

  if (!comanda) {
    const actual = await Comanda.findOne({ "items._id": itemId }, { "items.$": 1 }).lean();
    if (!actual) throw new HttpError(404, "Plato no encontrado");
    throw new HttpError(409, `Ese plato ya está ${actual.items[0].estado.toLowerCase()}`);
  }

  const json = platoDeCocina(comanda, comanda.items.find((i) => mismo(i._id, itemId)));
  publicar(TOPICS.cocina, json);
  if (estado === "LISTO") {
    publicar(TOPICS.salon, json);
    publicar(TOPICS.mesero(comanda.mesero_id), json);
    avisarSiLaMesaEstaCompleta(comanda);
  }
  res.json(json);
};

module.exports = {
  abrirSchema,
  agregarItemSchema,
  editarItemSchema,
  cerrarSchema,
  estadoCocinaSchema,
  itemParams,
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
  colaCocina,
  cambiarEstadoCocina,
};
