// Avisos en vivo de los pedidos web para administración y para el cliente.
// Son efectos secundarios: nunca cambian ni rompen la respuesta de la web.
const { publicar, TOPICS } = require("../ws/hub");
const { toPedidoAdmin, siguientesEstados, resumenCocina } = require("../utils/serializar");

const seguro = (fn) => {
  try {
    fn();
  } catch (error) {
    console.error("No se pudo avisar del pedido:", error.message);
  }
};

// pedido con usuario_id poblado (o el cliente aparte).
const nuevo = (pedido, cliente) =>
  seguro(() => publicar(TOPICS.adminPedidos, toPedidoAdmin(pedido, cliente)));

const estado = (pedido) =>
  seguro(() => {
    const id = String(pedido._id);
    const siguientes = siguientesEstados(pedido.estado);
    // `cocina` dice cuántos platos lleva listos la cocina (null si aún no entra).
    publicar(TOPICS.adminPedidosEstado, { id, estado: pedido.estado, siguientes, cocina: resumenCocina(pedido) });
    const usuarioId = pedido.usuario_id?._id ?? pedido.usuario_id;
    if (usuarioId) publicar(TOPICS.usuario(String(usuarioId)), { id, estado: pedido.estado });
  });

// Cambió quién lleva el pedido (con domiciliario_id poblado). Va por el mismo
// tema del estado: las pantallas ya mezclan lo que llega ahí con su pedido.
const domiciliario = (pedido) =>
  seguro(() => {
    const { id, estado: actual, siguientes, cocina, domiciliario: quien } = toPedidoAdmin(pedido);
    publicar(TOPICS.adminPedidosEstado, { id, estado: actual, siguientes, cocina, domiciliario: quien });
  });

module.exports = { nuevo, estado, domiciliario };
