const { Insumo, MovimientoInventario } = require("../models");
const { HttpError } = require("../utils/http");
const { redondear3 } = require("../utils/dinero");

/**
 * Aplica un movimiento de inventario dentro de una transacción (session).
 *
 * El stock se cambia con una actualización atómica en el servidor
 * (stock = round(stock + cantidad, 3)): nunca se lee y se escribe después, así
 * que dos meseros enviando a la vez no pierden descuentos.
 *
 * @param cantidad Con signo: negativa al consumir, positiva al reponer.
 */
const aplicarMovimiento = async (session, { insumoId, tipo, cantidad, motivo, comandaId, comandaItemId, usuarioId }) => {
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

module.exports = { aplicarMovimiento, ordenarPorInsumo };
