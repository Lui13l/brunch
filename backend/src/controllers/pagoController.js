const { Payment, Order } = require("../models");
const { aplicarEstado } = require("../services/pedidos");
const { HttpError, pick } = require("../utils/http");
const { verificarDueno } = require("../middleware/auth");
const { conTransaccion } = require("../utils/transaccion");

// El monto siempre es el total del pedido; no lo decide el cliente.
// Se hace en una transacción que escribe sobre el pedido: si llegan dos pagos
// a la vez, chocan y el segundo ve que ya existe uno.
const crear = async (req, res) => {
  const pago = await conTransaccion(async (session) => {
    const pedido = await Order.findById(req.body?.pedido_id).session(session);
    if (!pedido) throw new HttpError(404, "Pedido no encontrado");
    verificarDueno(req, pedido.usuario_id);

    if (pedido.estado === "cancelado") {
      throw new HttpError(400, "No se puede pagar un pedido cancelado");
    }
    const existe = await Payment.exists({ pedido_id: pedido._id, estado: { $in: ["pendiente", "aprobado"] } }).session(session);
    if (existe) throw new HttpError(409, "Este pedido ya tiene un pago pendiente o aprobado");

    const [nuevo] = await Payment.create(
      [{ ...pick(req.body, ["metodo", "referencia"]), pedido_id: pedido._id, usuario_id: pedido.usuario_id, monto: pedido.total }],
      { session }
    );
    await Order.updateOne({ _id: pedido._id }, { $set: { pago_id: nuevo._id } }, { session });
    return nuevo;
  });

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

  // Condicional: solo un pago pendiente cambia, y solo una vez.
  const pago = await Payment.findOneAndUpdate(
    { _id: req.params.id, estado: "pendiente" },
    { $set: { estado } },
    { returnDocument: "after" }
  );
  if (!pago) {
    const actual = await Payment.findById(req.params.id).lean();
    if (!actual) throw new HttpError(404, "Pago no encontrado");
    throw new HttpError(409, `El pago ya está ${actual.estado}`);
  }

  if (estado === "aprobado") {
    // Confirmar manda los platos a cocina y descuenta inventario (ver
    // services/pedidos.js). Si el admin ya lo había confirmado a mano, no hay
    // nada que hacer.
    const pedido = await Order.findOne({ _id: pago.pedido_id, estado: "pendiente" });
    if (pedido) {
      try {
        await aplicarEstado(pedido, "confirmado", req.usuario._id);
      } catch (err) {
        // 409: alguien lo cambió justo ahora. El pago ya quedó aprobado.
        if (err.status !== 409) throw err;
      }
    }
  }

  res.json(pago);
};

module.exports = { crear, listar, obtener, cambiarEstado };
