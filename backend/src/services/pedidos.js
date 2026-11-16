const { DeliveryPerson, Order } = require("../models");
const { HttpError } = require("../utils/http");
const { conTransaccion } = require("../utils/transaccion");
const eventos = require("./eventosPedido");
const { enviarPedido, devolverPedido } = require("./cocinaWeb");
const { avisarInventario } = require("./inventario");
const { facturarAlEntregar } = require("./facturas");
const { publicar, TOPICS } = require("../ws/hub");

const { TRANSICIONES } = Order;

const liberarDomiciliario = async (pedido) => {
  if (pedido.domiciliario_id) {
    await DeliveryPerson.findByIdAndUpdate(pedido.domiciliario_id, { estado: "disponible" });
  }
};

/**
 * Cambia el estado de un pedido web.
 *
 * Al confirmarse, sus platos entran a cocina y descuentan inventario; al
 * cancelarse, lo que no ha salido de cocina se devuelve. Por eso va en una
 * transacción: el cambio de estado y el inventario se guardan juntos o no se
 * guarda ninguno.
 *
 * @param usuarioId Quién hace el cambio (queda en el libro de inventario).
 */
const aplicarEstado = async (pedido, estado, usuarioId) => {
  if (!TRANSICIONES[pedido.estado]?.includes(estado)) {
    throw new HttpError(400, `No se puede pasar de "${pedido.estado}" a "${estado}"`);
  }
  const anterior = pedido.estado;

  const { actualizado, cocina } = await conTransaccion(async (session) => {
    // Condicional sobre el estado leído: si otro (el cliente cancelando, otro
    // admin) lo cambió entre medias, no se pisa su cambio.
    const doc = await Order.findOneAndUpdate(
      { _id: pedido._id, estado: anterior },
      { $set: { estado } },
      { returnDocument: "after", session }
    );
    if (!doc) {
      throw new HttpError(409, "El pedido cambió mientras tanto. Recarga e inténtalo de nuevo.");
    }

    let cocina = null;
    if (estado === "confirmado") cocina = await enviarPedido(session, { pedidoId: doc._id, usuarioId });
    if (estado === "cancelado") cocina = await devolverPedido(session, { pedidoId: doc._id, usuarioId });
    return { actualizado: doc, cocina };
  });

  pedido.set("estado", estado);
  if (estado === "entregado" || estado === "cancelado") await liberarDomiciliario(actualizado);
  // Pagado por transferencia y entregado: sale su comprobante por correo.
  if (estado === "entregado") await facturarAlEntregar(actualizado);

  // Avisos, ya con todo guardado.
  const tocoCocina = cocina?.enviado || cocina?.cancelados > 0;
  const fresco = tocoCocina ? await Order.findById(actualizado._id).lean() : actualizado;
  eventos.estado(fresco);
  if (tocoCocina) {
    publicar(TOPICS.cocina, { tipo: "pedidoWeb", pedidoId: String(actualizado._id) });
    avisarInventario();
  }
  if (cocina?.faltantes?.length > 0) {
    publicar(TOPICS.adminInventario, { pedidoId: String(actualizado._id), faltantes: cocina.faltantes });
  }
  return cocina;
};

module.exports = { liberarDomiciliario, aplicarEstado };
