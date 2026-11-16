const { z } = require("zod");
const { Order, DeliveryPerson } = require("../models");
const { HttpError } = require("../utils/http");
const { fecha, booleanoQuery, texto, objectId } = require("../utils/validar");
const { toPedidoAdmin } = require("../utils/serializar");
const { rangoLocal } = require("../utils/tiempo");
const { aplicarEstado, asignarDomiciliario: asignar } = require("../services/pedidos");
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
const domiciliarioSchema = z.object({ nombre: texto("El nombre"), apellido: texto("El apellido") });
const asignarSchema = z.object({ domiciliarioId: objectId });

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
  await aplicarEstado(pedido, req.valid.body.estado, req.usuario._id);
  await registrar(
    req.usuario,
    "CAMBIAR_ESTADO_PEDIDO",
    `Pedido web ${codigoCorto(pedido._id)}: ${anterior} → ${pedido.estado}`,
    SERVICIO.PEDIDOS
  );
  const actualizado = await poblar(Order.findById(pedido._id)).lean();
  res.json(toPedidoAdmin(actualizado));
};

// --- Domiciliarios, para asignarlos desde la app de comandas ---

const toDomiciliario = (d) => ({
  id: String(d._id),
  nombre: [d.nombre, d.apellido].filter(Boolean).join(" "),
  estado: d.estado,
});

// Los inactivos no se ofrecen: ya no trabajan con el restaurante.
const listarDomiciliarios = async (req, res) => {
  const domiciliarios = await DeliveryPerson.find({ estado: { $ne: "inactivo" } }).sort({ nombre: 1 }).lean();
  res.json(domiciliarios.map(toDomiciliario));
};

const crearDomiciliario = async (req, res) => {
  const domiciliario = await DeliveryPerson.create(req.valid.body);
  await registrar(
    req.usuario,
    "CREAR_DOMICILIARIO",
    `Registró al domiciliario ${domiciliario.nombre} ${domiciliario.apellido}`,
    SERVICIO.PEDIDOS
  );
  res.json(toDomiciliario(domiciliario));
};

const asignarDomiciliario = async (req, res) => {
  const pedido = await asignar(req.valid.params.id, req.valid.body.domiciliarioId);
  await registrar(
    req.usuario,
    "ASIGNAR_DOMICILIARIO",
    `Asignó a ${pedido.domiciliario_id.nombre} ${pedido.domiciliario_id.apellido} al pedido web ${codigoCorto(pedido._id)}`,
    SERVICIO.PEDIDOS
  );
  const actualizado = await poblar(Order.findById(pedido._id)).lean();
  res.json(toPedidoAdmin(actualizado));
};

module.exports = {
  listarSchema,
  estadoSchema,
  domiciliarioSchema,
  asignarSchema,
  listar,
  cambiarEstado,
  listarDomiciliarios,
  crearDomiciliario,
  asignarDomiciliario,
};
