const { Payment, Order } = require("../models");
const { HttpError, pick } = require("../utils/http");
const { verificarDueno } = require("../middleware/auth");

// El monto siempre es el total del pedido; no lo decide el cliente.
const crear = async (req, res) => {
  const pedido = await Order.findById(req.body?.pedido_id);
  if (!pedido) throw new HttpError(404, "Pedido no encontrado");
  verificarDueno(req, pedido.usuario_id);

  if (pedido.estado === "cancelado") {
    throw new HttpError(400, "No se puede pagar un pedido cancelado");
  }
  if (await Payment.exists({ pedido_id: pedido._id, estado: { $in: ["pendiente", "aprobado"] } })) {
    throw new HttpError(409, "Este pedido ya tiene un pago pendiente o aprobado");
  }

  const pago = await Payment.create({
    ...pick(req.body, ["metodo", "referencia"]),
    pedido_id: pedido._id,
    usuario_id: pedido.usuario_id,
    monto: pedido.total,
  });

  pedido.pago_id = pago._id;
  await pedido.save();

  res.status(201).json(pago);
};

const listar = async (req, res) => {
  const filtro = pick(req.query, ["estado", "metodo", "pedido_id"]);
  const pagos = await Payment.find(filtro).sort({ createdAt: -1 });
  res.json(pagos);
};

const obtener = async (req, res) => {
  const pago = await Payment.findById(req.params.id);
  if (!pago) throw new HttpError(404, "Pago no encontrado");
  verificarDueno(req, pago.usuario_id);
  res.json(pago);
};

// Al aprobar el pago, un pedido pendiente pasa a confirmado.
const cambiarEstado = async (req, res) => {
  const { estado } = req.body || {};
  if (!["aprobado", "rechazado"].includes(estado)) {
    throw new HttpError(400, "El estado debe ser aprobado o rechazado");
  }

  const pago = await Payment.findById(req.params.id);
  if (!pago) throw new HttpError(404, "Pago no encontrado");
  if (pago.estado !== "pendiente") {
    throw new HttpError(400, `El pago ya está ${pago.estado}`);
  }

  pago.estado = estado;
  await pago.save();

  if (estado === "aprobado") {
    await Order.updateOne({ _id: pago.pedido_id, estado: "pendiente" }, { estado: "confirmado" });
  }

  res.json(pago);
};

module.exports = { crear, listar, obtener, cambiarEstado };
