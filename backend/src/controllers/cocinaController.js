const { Comanda, Order } = require("../models");
const { HttpError } = require("../utils/http");
const { toComandaItem, toPlatoPedidoCocina } = require("../utils/serializar");
const { mismo, avisarSiLaMesaEstaCompleta } = require("../services/comandas");
const { aplicarEstado } = require("../services/pedidos");
const eventosPedido = require("../services/eventosPedido");
const { publicar, TOPICS } = require("../ws/hub");

const { EN_COCINA } = Comanda;
const { CON_COCINA } = Order;

// Pantalla de la cocina: platos de las cuentas abiertas del salón y de los
// pedidos web confirmados. Una cuenta cerrada a la fuerza ya canceló lo suyo y
// no debe dejar tickets en la cola.
//
// Cada plato lleva su `contenedor` (la mesa o el domicilio al que pertenece):
// la pantalla los agrupa así para que la cocina saque cada pedido completo.

// "Mesa 4" o, si la cuenta junta varias mesas, "Mesas 4 + 5".
const tituloDeMesas = (comanda) => {
  const numeros = [comanda.mesa_id?.numero, ...(comanda.mesas_extra ?? []).map((m) => m?.numero)].filter(
    (n) => n != null
  );
  return numeros.length > 1 ? `Mesas ${numeros.join(" + ")}` : `Mesa ${numeros[0] ?? "?"}`;
};

const platoDeCocina = (comanda, item) => ({
  ...toComandaItem(item),
  comandaId: String(comanda._id),
  pedidoId: null,
  mesa: comanda.mesa_id?.numero ?? null,
  contenedor: { tipo: "mesa", id: `comanda-${comanda._id}`, titulo: tituloDeMesas(comanda) },
});

const poblarMesas = (q) => q.populate("mesa_id", "numero").populate("mesas_extra", "numero");

const colaCocina = async (req, res) => {
  const [comandas, pedidos] = await Promise.all([
    poblarMesas(Comanda.find({ estado: "ABIERTA", "items.estado": { $in: EN_COCINA } })).lean(),
    Order.find({ estado: { $in: CON_COCINA }, "items.estado_cocina": { $in: EN_COCINA } }).lean(),
  ]);

  const platos = [
    ...comandas.flatMap((c) => c.items.filter((i) => EN_COCINA.includes(i.estado)).map((i) => platoDeCocina(c, i))),
    ...pedidos.flatMap((p) =>
      p.items.filter((i) => EN_COCINA.includes(i.estado_cocina)).map((i) => toPlatoPedidoCocina(p, i))
    ),
  ];
  // Lo más viejo primero. Las fechas ya van en hora local sin zona: se
  // comparan como texto.
  platos.sort((a, b) => String(a.fechaEnvio).localeCompare(String(b.fechaEnvio)));
  res.json(platos);
};

// Plato de un pedido web: mismo cambio condicional que el de una mesa.
// Devuelve null si ese id no es de un pedido que esté en cocina.
const cambiarEstadoPedidoWeb = async (itemId, estado, usuarioId) => {
  const pedido = await Order.findOneAndUpdate(
    { estado: { $in: CON_COCINA }, items: { $elemMatch: { _id: itemId, estado_cocina: { $in: EN_COCINA } } } },
    { $set: { "items.$.estado_cocina": estado, "items.$.fecha_listo": estado === "LISTO" ? new Date() : null } },
    { returnDocument: "after" }
  );
  if (!pedido) return null;

  // En cuanto la cocina toca un plato, el pedido está "preparando": el cliente
  // lo ve en su perfil sin que el admin tenga que cambiarlo a mano.
  if (pedido.estado === "confirmado") {
    try {
      await aplicarEstado(pedido, "preparando", usuarioId);
    } catch (err) {
      // 409: el admin lo cambió a la vez. El plato ya quedó marcado.
      if (err.status !== 409) throw err;
    }
  }

  const json = toPlatoPedidoCocina(pedido, pedido.items.find((i) => mismo(i._id, itemId)));
  publicar(TOPICS.cocina, json);
  // El panel de pedidos ve el avance ("2 de 3 listos") y cuándo se puede despachar.
  eventosPedido.estado(pedido);
  return json;
};

const cambiarEstadoCocina = async (req, res) => {
  const itemId = req.valid.params.id;
  const { estado } = req.valid.body;

  const comanda = await poblarMesas(
    Comanda.findOneAndUpdate(
      { estado: "ABIERTA", items: { $elemMatch: { _id: itemId, estado: { $in: EN_COCINA } } } },
      { $set: { "items.$.estado": estado, "items.$.fecha_listo": estado === "LISTO" ? new Date() : null } },
      { returnDocument: "after" }
    )
  ).lean();

  if (!comanda) {
    const deWeb = await cambiarEstadoPedidoWeb(itemId, estado, req.usuario._id);
    if (deWeb) return res.json(deWeb);

    const actual = await Comanda.findOne({ "items._id": itemId }, { estado: 1, "items.$": 1 }).lean();
    if (actual) {
      if (actual.estado !== "ABIERTA") throw new HttpError(409, `La comanda ya está ${actual.estado.toLowerCase()}`);
      throw new HttpError(409, `Ese plato ya está ${actual.items[0].estado.toLowerCase()}`);
    }
    const pedido = await Order.findOne({ "items._id": itemId }, { estado: 1, "items.$": 1 }).lean();
    if (!pedido) throw new HttpError(404, "Plato no encontrado");
    if (!CON_COCINA.includes(pedido.estado)) throw new HttpError(409, `El pedido ya está ${pedido.estado.replace("_", " ")}`);
    throw new HttpError(409, `Ese plato ya está ${String(pedido.items[0].estado_cocina).toLowerCase()}`);
  }

  const json = platoDeCocina(comanda, comanda.items.find((i) => mismo(i._id, itemId)));
  publicar(TOPICS.cocina, json);
  if (estado === "LISTO") {
    publicar(TOPICS.salon, json);
    publicar(TOPICS.mesero(comanda.mesero_id), json);
    avisarSiLaMesaEstaCompleta(comanda);
  }
  res.json(json);
};

module.exports = { colaCocina, cambiarEstadoCocina };
