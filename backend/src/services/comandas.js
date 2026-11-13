const mongoose = require("mongoose");
const { Comanda, RecetaItem, MovimientoInventario } = require("../models");
const { HttpError } = require("../utils/http");
const { redondear2, redondear3 } = require("../utils/dinero");
const { codigoCorto } = require("../utils/codigo");
const { aplicarMovimiento, ordenarPorInsumo } = require("./inventario");
const { publicar, TOPICS } = require("../ws/hub");

// Reglas de negocio de las comandas del salón. Las funciones que reciben una
// `session` se ejecutan dentro de una transacción y no tienen efectos externos
// (publicar o auditar va después del commit, en el controlador).

const { EN_COCINA } = Comanda;
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

// Total cobrable: lo que no se canceló, con 2 decimales.
const calcularTotal = (items) =>
  redondear2(
    items
      .filter((i) => i.estado !== "CANCELADO")
      .reduce((suma, i) => suma + Number(i.precio_unitario) * i.cantidad, 0)
  );

/**
 * Pasa los platos en borrador a la cocina y descuenta el inventario por receta.
 * Marcar los platos es la puerta de entrada: si otra petición los marcó
 * primero, esta no encuentra nada y no descuenta dos veces. Si el stock no
 * alcanza NO se bloquea: queda negativo y se marcan los faltantes.
 */
const enviar = async (session, { comandaId, usuarioId }) => {
  const lote = new mongoose.Types.ObjectId();
  const comanda = await Comanda.findOneAndUpdate(
    { _id: comandaId, estado: "ABIERTA", "items.estado": "BORRADOR" },
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
    const actual = await Comanda.findById(comandaId).session(session).lean();
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
      motivo: `Comanda ${codigoCorto(comandaId)}`,
      comandaId: comanda._id,
      comandaItemId: consumo.comandaItemId,
      usuarioId,
    });
    if (insumo.stock < 0) {
      faltantesPorInsumo.set(String(insumo._id), { insumo: insumo.nombre, unidad: insumo.unidad, stock: insumo.stock });
      itemsConFaltante.add(String(consumo.comandaItemId));
    }
  }

  if (itemsConFaltante.size > 0) {
    await Comanda.updateOne(
      { _id: comandaId },
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
};

/**
 * Devuelve al inventario lo que realmente consumieron unos platos (leído del
 * libro de movimientos, no de la receta actual, que pudo cambiar).
 */
const devolverConsumos = async (session, { comandaId, itemIds, usuarioId, motivo }) => {
  if (itemIds.length === 0) return;
  const consumos = await MovimientoInventario.find({ comanda_item_id: { $in: itemIds }, tipo: "CONSUMO" })
    .session(session)
    .lean();
  for (const mov of ordenarPorInsumo(consumos.map((c) => ({ ...c, insumoId: c.insumo_id })))) {
    await aplicarMovimiento(session, {
      insumoId: mov.insumo_id,
      tipo: "DEVOLUCION",
      cantidad: -mov.cantidad,
      motivo,
      comandaId,
      comandaItemId: mov.comanda_item_id,
      usuarioId,
    });
  }
};

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

module.exports = {
  mismo,
  cargar,
  exigirAbierta,
  diagnosticarItem,
  calcularTotal,
  enviar,
  devolverConsumos,
  avisarSiLaMesaEstaCompleta,
};
