const { Insumo, MovimientoInventario, RecetaItem } = require("../models");
const { HttpError } = require("../utils/http");
const { redondear3 } = require("../utils/dinero");
const { publicar, TOPICS } = require("../ws/hub");

const mismo = (a, b) => String(a) === String(b);

/**
 * Aplica un movimiento de inventario dentro de una transacción (session).
 *
 * El stock se cambia con una actualización atómica en el servidor
 * (stock = round(stock + cantidad, 3)): nunca se lee y se escribe después, así
 * que dos meseros enviando a la vez no pierden descuentos.
 *
 * @param cantidad Con signo: negativa al consumir, positiva al reponer.
 */
const aplicarMovimiento = async (
  session,
  { insumoId, tipo, cantidad, motivo, comandaId, comandaItemId, pedidoId, pedidoItemId, usuarioId }
) => {
  const delta = redondear3(cantidad);
  const insumo = await Insumo.findOneAndUpdate(
    { _id: insumoId },
    [{ $set: { stock: { $round: [{ $add: ["$stock", delta] }, 3] } } }],
    { session, returnDocument: "after", updatePipeline: true }
  );
  if (!insumo) throw new HttpError(404, "Insumo no encontrado");

  await MovimientoInventario.create(
    [
      {
        insumo_id: insumo._id,
        tipo,
        cantidad: delta,
        stock_resultante: insumo.stock,
        motivo: motivo ?? null,
        comanda_id: comandaId ?? null,
        comanda_item_id: comandaItemId ?? null,
        pedido_id: pedidoId ?? null,
        pedido_item_id: pedidoItemId ?? null,
        usuario_id: usuarioId ?? null,
      },
    ],
    { session }
  );
  return insumo;
};

// Siempre en el mismo orden para que dos transacciones no choquen entre sí.
const ordenarPorInsumo = (consumos) =>
  [...consumos].sort((a, b) => String(a.insumoId).localeCompare(String(b.insumoId)));

/**
 * Descuenta del inventario lo que consumen unos platos según su receta. Lo
 * usan las comandas del salón y los pedidos web al entrar a cocina.
 *
 * Si el stock no alcanza NO se bloquea: queda negativo y se devuelve en
 * `faltantes`, con los platos afectados en `itemsConFaltante`.
 *
 * @param lineas [{ itemId, menuItemId, cantidad, nombre }]
 * @param origen { comandaId } o { pedidoId }: a qué cuenta se anota el consumo
 */
const consumirPorReceta = async (session, { lineas, motivo, usuarioId, comandaId, pedidoId }) => {
  const menuIds = [...new Set(lineas.map((l) => l.menuItemId).filter(Boolean).map(String))];
  const recetas = await RecetaItem.find({ menu_item_id: { $in: menuIds } }).session(session).lean();

  const consumos = [];
  for (const linea of lineas) {
    for (const receta of recetas.filter((r) => mismo(r.menu_item_id, linea.menuItemId))) {
      consumos.push({
        insumoId: receta.insumo_id,
        itemId: linea.itemId,
        cantidad: redondear3(receta.cantidad * linea.cantidad),
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
      motivo,
      comandaId,
      comandaItemId: comandaId ? consumo.itemId : null,
      pedidoId,
      pedidoItemId: pedidoId ? consumo.itemId : null,
      usuarioId,
    });
    if (insumo.stock < 0) {
      faltantesPorInsumo.set(String(insumo._id), { insumo: insumo.nombre, unidad: insumo.unidad, stock: insumo.stock });
      itemsConFaltante.add(String(consumo.itemId));
    }
  }

  const conReceta = new Set(recetas.map((r) => String(r.menu_item_id)));
  const sinReceta = [...new Set(lineas.filter((l) => !conReceta.has(String(l.menuItemId))).map((l) => l.nombre))];
  return { faltantes: [...faltantesPorInsumo.values()], itemsConFaltante, sinReceta };
};

/**
 * Devuelve al inventario lo que realmente consumieron unos platos (leído del
 * libro de movimientos, no de la receta actual, que pudo cambiar).
 *
 * @param campo "comanda_item_id" o "pedido_item_id": de qué tipo son los platos
 */
const devolverConsumosDe = async (session, { campo, itemIds, usuarioId, motivo, comandaId, pedidoId }) => {
  if (itemIds.length === 0) return;
  const consumos = await MovimientoInventario.find({ [campo]: { $in: itemIds }, tipo: "CONSUMO" })
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
      pedidoId,
      pedidoItemId: mov.pedido_item_id,
      usuarioId,
    });
  }
};

// Avisa a las pantallas que el inventario cambió: la de insumos se recarga y
// las cuentas abiertas vuelven a pedir la carta (un plato pudo quedar agotado
// o volver a estar disponible). Se llama después del commit, nunca dentro de
// la transacción.
const avisarInventario = () => {
  publicar(TOPICS.adminInventario, { tipo: "inventario" });
  publicar(TOPICS.salon, { tipo: "carta" });
};

module.exports = { aplicarMovimiento, ordenarPorInsumo, consumirPorReceta, devolverConsumosDe, avisarInventario };
