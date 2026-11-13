const { z } = require("zod");
const { Order } = require("../models");
const { HttpError } = require("../utils/http");
const { fecha, booleanoQuery } = require("../utils/validar");
const { toPedidoAdmin } = require("../utils/serializar");
const { rangoLocal } = require("../utils/tiempo");
const { aplicarEstado } = require("../services/pedidos");
const { registrar, SERVICIO } = require("../services/auditoria");
const { codigoCorto } = require("../utils/codigo");

const { TRANSICIONES, ACTIVOS } = Order;
const ESTADOS = Object.keys(TRANSICIONES);
const estadoEnum = z.enum(ESTADOS, { error: `El estado debe ser uno de: ${ESTADOS.join(", ")}` });

const listarSchema = z.object({
  estado: estadoEnum.optional(),
  activos: booleanoQuery("activos").optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

const estadoSchema = z.object({ estado: estadoEnum });

const poblar = (q) =>
  q.populate("usuario_id", "nombre correo celular").populate("domiciliario_id", "nombre apellido telefono");


// Pedidos a domicilio de la web, para la pantalla en vivo del admin.
const listar = async (req, res) => {
  const { estado, activos, desde, hasta } = req.valid.query;
  const filtro = {};
  if (estado) filtro.estado = estado;
  else if (activos) filtro.estado = { $in: ACTIVOS };
  if (desde || hasta) {
    const { inicio, fin } = rangoLocal(desde, hasta);
    filtro.fecha_inicio = {};
    if (inicio) filtro.fecha_inicio.$gte = inicio;
    if (fin) filtro.fecha_inicio.$lt = fin;
  }
  const pedidos = await poblar(Order.find(filtro)).sort({ fecha_inicio: -1 }).limit(200).lean();
  res.json(pedidos.map((p) => toPedidoAdmin(p)));
};

const cambiarEstado = async (req, res) => {
  const pedido = await Order.findById(req.valid.params.id);
  if (!pedido) throw new HttpError(404, "Pedido no encontrado");
  const anterior = pedido.estado;
  await aplicarEstado(pedido, req.valid.body.estado);
  await registrar(
    req.usuario,
    "CAMBIAR_ESTADO_PEDIDO",
    `Pedido web ${codigoCorto(pedido._id)}: ${anterior} → ${pedido.estado}`,
    SERVICIO.PEDIDOS
  );
  const actualizado = await poblar(Order.findById(pedido._id)).lean();
  res.json(toPedidoAdmin(actualizado));
};

module.exports = { listarSchema, estadoSchema, listar, cambiarEstado };
