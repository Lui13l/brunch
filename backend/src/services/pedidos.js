const { DeliveryPerson, Order } = require("../models");
const { HttpError } = require("../utils/http");
const { conTransaccion } = require("../utils/transaccion");
const eventos = require("./eventosPedido");
const { enviarPedido, devolverPedido } = require("./cocinaWeb");
const { avisarInventario } = require("./inventario");
const { facturarAlEntregar } = require("./facturas");
const { publicar, TOPICS } = require("../ws/hub");
const { publicarCaja } = require("./caja");

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
  // Un pedido cancelado deja de contar en la caja aunque su pago estuviera aprobado.
  if (estado === "cancelado") publicarCaja();
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

/**
 * Asigna (o cambia) el domiciliario de un pedido web que no ha terminado.
 * El anterior, si había otro, vuelve a quedar disponible.
 *
 * Lo usan la web (`PATCH /api/pedidos/:id/domiciliario`) y la app de comandas
 * (`PATCH /api/admin/pedidos/:id/domiciliario`).
 */
const asignarDomiciliario = async (pedidoId, domiciliarioId) => {
  const pedido = await Order.findById(pedidoId);
  if (!pedido) throw new HttpError(404, "Pedido no encontrado");
  if (["entregado", "cancelado"].includes(pedido.estado)) {
    throw new HttpError(400, `El pedido ya está ${pedido.estado}`);
  }
  if (String(pedido.domiciliario_id ?? "") === String(domiciliarioId)) {
    throw new HttpError(409, "Ese domiciliario ya lleva este pedido");
  }

  // Se "reclama" el domiciliario de forma atómica: si dos pedidos lo piden a la
  // vez, solo uno lo consigue.
  const domiciliario = await DeliveryPerson.findOneAndUpdate(
    { _id: domiciliarioId, estado: "disponible" },
    { $set: { estado: "ocupado" } },
    { returnDocument: "after" }
  );
  if (!domiciliario) {
    if (!(await DeliveryPerson.exists({ _id: domiciliarioId }))) {
      throw new HttpError(404, "Domiciliario no encontrado");
    }
    throw new HttpError(409, "El domiciliario no está disponible");
  }

  const anterior = await Order.findOneAndUpdate(
    { _id: pedido._id, estado: { $nin: ["entregado", "cancelado"] } },
    { $set: { domiciliario_id: domiciliario._id } },
    { returnDocument: "before" }
  );
  if (!anterior) {
    // El pedido terminó mientras tanto: el domiciliario vuelve a quedar libre.
    await DeliveryPerson.updateOne({ _id: domiciliario._id }, { $set: { estado: "disponible" } });
    throw new HttpError(400, "El pedido ya terminó");
  }
  if (anterior.domiciliario_id && String(anterior.domiciliario_id) !== String(domiciliario._id)) {
    await liberarDomiciliario(anterior);
  }

  // Las pantallas de pedidos abiertas ven el cambio sin recargar.
  const fresco = await Order.findById(pedido._id).populate("domiciliario_id", "nombre apellido").lean();
  eventos.domiciliario(fresco);
  return fresco;
};

module.exports = { liberarDomiciliario, aplicarEstado, asignarDomiciliario };
