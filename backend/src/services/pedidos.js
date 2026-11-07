const { DeliveryPerson, Order } = require("../models");
const { HttpError } = require("../utils/http");
const eventos = require("./eventosPedido");

// Estados a los que puede pasar un pedido web desde cada estado.
const TRANSICIONES = {
  pendiente: ["confirmado", "cancelado"],
  confirmado: ["preparando", "cancelado"],
  preparando: ["en_camino", "cancelado"],
  en_camino: ["entregado"],
  entregado: [],
  cancelado: [],
};

const ACTIVOS = ["pendiente", "confirmado", "preparando", "en_camino"];

const liberarDomiciliario = async (pedido) => {
  if (pedido.domiciliario_id) {
    await DeliveryPerson.findByIdAndUpdate(pedido.domiciliario_id, { estado: "disponible" });
  }
};

const aplicarEstado = async (pedido, estado) => {
  if (!TRANSICIONES[pedido.estado]?.includes(estado)) {
    throw new HttpError(400, `No se puede pasar de "${pedido.estado}" a "${estado}"`);
  }
  // Condicional sobre el estado leído: si otro (el cliente cancelando, otro
  // admin) lo cambió entre medias, no se pisa su cambio.
  const anterior = pedido.estado;
  const actualizado = await Order.findOneAndUpdate(
    { _id: pedido._id, estado: anterior },
    { $set: { estado } },
    { returnDocument: "after" }
  );
  if (!actualizado) {
    throw new HttpError(409, "El pedido cambió mientras tanto. Recarga e inténtalo de nuevo.");
  }
  pedido.set("estado", estado);
  if (estado === "entregado" || estado === "cancelado") await liberarDomiciliario(actualizado);
  eventos.estado(actualizado, TRANSICIONES);
};

module.exports = { TRANSICIONES, ACTIVOS, liberarDomiciliario, aplicarEstado };
