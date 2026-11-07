// Avisos en vivo de los pedidos web para administración y para el cliente.
// Son efectos secundarios: nunca cambian ni rompen la respuesta de la web.
const { publicar, TOPICS } = require("../ws/hub");
const { toPedidoAdmin } = require("../utils/serializar");

const seguro = (fn) => {
  try {
    fn();
  } catch (error) {
    console.error("No se pudo avisar del pedido:", error.message);
  }
};

// pedido con usuario_id poblado (o el cliente aparte) y las transiciones posibles.
const nuevo = (pedido, cliente, transiciones) =>
  seguro(() => publicar(TOPICS.adminPedidos, toPedidoAdmin(pedido, transiciones, cliente)));

const estado = (pedido, transiciones) =>
  seguro(() => {
    const id = String(pedido._id);
    const siguientes = transiciones[pedido.estado] ?? [];
    publicar(TOPICS.adminPedidosEstado, { id, estado: pedido.estado, siguientes });
    const usuarioId = pedido.usuario_id?._id ?? pedido.usuario_id;
    if (usuarioId) publicar(TOPICS.usuario(String(usuarioId)), { id, estado: pedido.estado });
  });

module.exports = { nuevo, estado };
