const mongoose = require("mongoose");
const { Order, Comanda } = require("../models");
const { codigoCorto } = require("../utils/codigo");
const { consumirPorReceta, devolverConsumosDe } = require("./inventario");

// Paso de los pedidos web por la cocina. Un pedido entra cuando se confirma
// (lo confirma el admin o se aprueba su pago) y sus platos se comportan como
// los de una mesa: PENDIENTE → PREPARANDO → LISTO, descontando inventario por
// receta. Las funciones reciben una `session`: van dentro de una transacción
// y no tienen efectos externos (avisar va después del commit).

const { EN_COCINA } = Comanda;

/**
 * Manda a cocina los platos de un pedido recién confirmado.
 *
 * `enviado_cocina_en` es el candado: si otra petición ya lo envió (el admin
 * confirma a la vez que se aprueba el pago), esta no encuentra nada y no
 * descuenta inventario dos veces.
 */
const enviarPedido = async (session, { pedidoId, usuarioId }) => {
  const ahora = new Date();
  const pedido = await Order.findOneAndUpdate(
    { _id: pedidoId, enviado_cocina_en: null },
    { $set: { enviado_cocina_en: ahora } },
    { session, returnDocument: "after" }
  ).lean();
  if (!pedido) return { enviado: false, faltantes: [], sinReceta: [] };

  // Los pedidos anteriores a esta función no tienen _id en sus platos.
  const items = pedido.items.map((i) => ({
    ...i,
    _id: i._id ?? new mongoose.Types.ObjectId(),
    estado_cocina: "PENDIENTE",
    inventario_aplicado: true,
    fecha_envio: ahora,
    fecha_listo: null,
  }));

  const { faltantes, itemsConFaltante, sinReceta } = await consumirPorReceta(session, {
    lineas: items.map((i) => ({ itemId: i._id, menuItemId: i.menu_item_id, cantidad: i.cantidad, nombre: i.nombre })),
    motivo: `Pedido web ${codigoCorto(pedidoId)}`,
    pedidoId: pedido._id,
    usuarioId,
  });
  for (const item of items) item.falto_stock = itemsConFaltante.has(String(item._id));

  await Order.updateOne({ _id: pedido._id }, { $set: { items } }, { session });
  return { enviado: true, faltantes, sinReceta };
};

/**
 * Al cancelar un pedido que ya estaba en cocina: los platos que aún no han
 * salido se cancelan y devuelven lo que consumieron. Lo que ya está listo se
 * cocinó de verdad y no se devuelve.
 */
const devolverPedido = async (session, { pedidoId, usuarioId }) => {
  const pedido = await Order.findById(pedidoId).session(session).lean();
  if (!pedido?.enviado_cocina_en) return { cancelados: 0 };

  const enCocina = pedido.items.filter((i) => EN_COCINA.includes(i.estado_cocina));
  if (enCocina.length === 0) return { cancelados: 0 };

  await devolverConsumosDe(session, {
    campo: "pedido_item_id",
    itemIds: enCocina.filter((i) => i.inventario_aplicado).map((i) => i._id),
    usuarioId,
    motivo: `Cancelación del pedido web ${codigoCorto(pedidoId)}`,
    pedidoId: pedido._id,
  });
  await Order.updateOne(
    { _id: pedido._id },
    { $set: { "items.$[c].estado_cocina": "CANCELADO", "items.$[c].inventario_aplicado": false } },
    { arrayFilters: [{ "c.estado_cocina": { $in: EN_COCINA } }], session }
  );
  return { cancelados: enCocina.length };
};

module.exports = { enviarPedido, devolverPedido };
