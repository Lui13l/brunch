const mongoose = require("mongoose");
const { Comanda, Mesa } = require("../models");
const { HttpError } = require("../utils/http");
const { redondear2 } = require("../utils/dinero");
const { codigoCorto } = require("../utils/codigo");
const { consumirPorReceta, devolverConsumosDe } = require("./inventario");
const { publicar, TOPICS } = require("../ws/hub");

// Reglas de negocio de las comandas del salón. Las funciones que reciben una
// `session` se ejecutan dentro de una transacción y no tienen efectos externos
// (publicar o auditar va después del commit, en el controlador).

const { EN_COCINA } = Comanda;
const mismo = (a, b) => String(a) === String(b);

const cargar = async (id) => {
  const comanda = await Comanda.findById(id).populate("mesa_id", "numero").populate("mesas_extra", "numero").lean();
  if (!comanda) throw new HttpError(404, "Comanda no encontrada");
  return comanda;
};

/**
 * Comprueba que unas mesas existen, están en servicio y no las ocupa otra
 * cuenta abierta (ni como mesa principal ni juntada a otra). Va dentro de una
 * transacción.
 *
 * Tocar `reclamada_en` es el candado: si dos cuentas reclaman la misma mesa a
 * la vez, sus transacciones chocan en ese documento, una se reintenta y
 * entonces ya ve la mesa ocupada.
 *
 * @param exceptoComandaId La cuenta que las reclama (al cambiar sus mesas).
 */
const reclamarMesas = async (session, mesaIds, exceptoComandaId = null) => {
  const ids = [...new Set(mesaIds.map(String))];
  await Mesa.updateMany({ _id: { $in: ids } }, { $set: { reclamada_en: new Date() } }, { session });
  const mesas = await Mesa.find({ _id: { $in: ids } }).session(session).lean();
  if (mesas.length !== ids.length) throw new HttpError(404, "Mesa no encontrada");
  const numero = (id) => mesas.find((m) => mismo(m._id, id))?.numero;

  const inactiva = mesas.find((m) => !m.activa);
  if (inactiva) throw new HttpError(409, `La mesa ${inactiva.numero} está fuera de servicio`);

  const filtro = { estado: "ABIERTA", $or: [{ mesa_id: { $in: ids } }, { mesas_extra: { $in: ids } }] };
  if (exceptoComandaId) filtro._id = { $ne: exceptoComandaId };
  const otra = await Comanda.findOne(filtro).session(session).lean();
  if (!otra) return mesas;

  if (ids.includes(String(otra.mesa_id))) {
    throw new HttpError(409, `La mesa ${numero(otra.mesa_id)} ya tiene una cuenta abierta`);
  }
  const junta = otra.mesas_extra.find((m) => ids.includes(String(m)));
  throw new HttpError(409, `La mesa ${numero(junta)} está junta con otra cuenta abierta`);
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
  const { faltantes, itemsConFaltante, sinReceta } = await consumirPorReceta(session, {
    lineas: items.map((i) => ({ itemId: i._id, menuItemId: i.menu_item_id, cantidad: i.cantidad, nombre: i.nombre_item })),
    motivo: `Comanda ${codigoCorto(comandaId)}`,
    comandaId: comanda._id,
    usuarioId,
  });

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

  return { faltantes, sinReceta };
};

/**
 * Devuelve al inventario lo que realmente consumieron unos platos (leído del
 * libro de movimientos, no de la receta actual, que pudo cambiar).
 */
const devolverConsumos = (session, { comandaId, itemIds, usuarioId, motivo }) =>
  devolverConsumosDe(session, { campo: "comanda_item_id", itemIds, usuarioId, motivo, comandaId });

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
  reclamarMesas,
  exigirAbierta,
  diagnosticarItem,
  calcularTotal,
  enviar,
  devolverConsumos,
  avisarSiLaMesaEstaCompleta,
};
