const { Order, MenuItem, DeliveryPerson } = require("../models");
const { HttpError, pick } = require("../utils/http");
const { verificarDueno } = require("../middleware/auth");

// Estados a los que puede pasar un pedido desde cada estado.
const TRANSICIONES = {
  pendiente: ["confirmado", "cancelado"],
  confirmado: ["preparando", "cancelado"],
  preparando: ["en_camino", "cancelado"],
  en_camino: ["entregado"],
  entregado: [],
  cancelado: [],
};

const buscarPedido = async (id) => {
  const pedido = await Order.findById(id);
  if (!pedido) throw new HttpError(404, "Pedido no encontrado");
  return pedido;
};

const liberarDomiciliario = async (pedido) => {
  if (pedido.domiciliario_id) {
    await DeliveryPerson.findByIdAndUpdate(pedido.domiciliario_id, { estado: "disponible" });
  }
};

const aplicarEstado = async (pedido, estado) => {
  if (!TRANSICIONES[pedido.estado]?.includes(estado)) {
    throw new HttpError(400, `No se puede pasar de "${pedido.estado}" a "${estado}"`);
  }
  pedido.estado = estado;
  if (estado === "entregado" || estado === "cancelado") await liberarDomiciliario(pedido);
  await pedido.save();
};

// El cliente solo manda productos y cantidades; nombres, precios y total
// se toman de la base de datos para que no se puedan manipular.
const crear = async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, "El pedido debe tener al menos un producto");
  }

  const ids = items.map((i) => i.menu_item_id);
  const productos = await MenuItem.find({ _id: { $in: ids }, activo: true });
  const porId = new Map(productos.map((p) => [String(p._id), p]));

  const lineas = items.map((item) => {
    const producto = porId.get(String(item.menu_item_id));
    if (!producto) {
      throw new HttpError(400, `Producto no disponible: ${item.menu_item_id}`);
    }
    const cantidad = Number(item.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      throw new HttpError(400, `Cantidad inválida para ${producto.nombre}`);
    }
    return {
      menu_item_id: producto._id,
      nombre: producto.nombre,
      cantidad,
      precio_unitario: producto.precio,
      subtotal: producto.precio * cantidad,
    };
  });

  const datos = pick(req.body, ["direccion_pedido", "observaciones", "fecha_programada"]);
  if (datos.fecha_programada && new Date(datos.fecha_programada) < new Date()) {
    throw new HttpError(400, "La fecha programada no puede estar en el pasado");
  }

  const pedido = await Order.create({
    ...datos,
    direccion_pedido: datos.direccion_pedido || req.usuario.direccion,
    usuario_id: req.usuario._id,
    items: lineas,
    total: lineas.reduce((suma, l) => suma + l.subtotal, 0),
  });

  res.status(201).json(pedido);
};

const misPedidos = async (req, res) => {
  const pedidos = await Order.find({ usuario_id: req.usuario._id }).sort({ createdAt: -1 });
  res.json(pedidos);
};

const listar = async (req, res) => {
  const filtro = pick(req.query, ["estado", "usuario_id", "domiciliario_id"]);
  const pedidos = await Order.find(filtro)
    .populate("usuario_id", "nombre correo celular")
    .populate("domiciliario_id", "nombre apellido")
    .sort({ createdAt: -1 });
  res.json(pedidos);
};

const obtener = async (req, res) => {
  const pedido = await Order.findById(req.params.id)
    .populate("domiciliario_id", "nombre apellido")
    .populate("pago_id");
  if (!pedido) throw new HttpError(404, "Pedido no encontrado");
  verificarDueno(req, pedido.usuario_id);
  res.json(pedido);
};

const cambiarEstado = async (req, res) => {
  const pedido = await buscarPedido(req.params.id);
  await aplicarEstado(pedido, req.body?.estado);
  res.json(pedido);
};

const cancelar = async (req, res) => {
  const pedido = await buscarPedido(req.params.id);
  verificarDueno(req, pedido.usuario_id);
  if (!["pendiente", "confirmado"].includes(pedido.estado)) {
    throw new HttpError(400, "Solo se pueden cancelar pedidos pendientes o confirmados");
  }
  await aplicarEstado(pedido, "cancelado");
  res.json(pedido);
};

const asignarDomiciliario = async (req, res) => {
  const pedido = await buscarPedido(req.params.id);
  if (["entregado", "cancelado"].includes(pedido.estado)) {
    throw new HttpError(400, `El pedido ya está ${pedido.estado}`);
  }

  const domiciliario = await DeliveryPerson.findById(req.body?.domiciliario_id);
  if (!domiciliario) throw new HttpError(404, "Domiciliario no encontrado");
  if (domiciliario.estado !== "disponible") {
    throw new HttpError(409, "El domiciliario no está disponible");
  }

  await liberarDomiciliario(pedido);
  domiciliario.estado = "ocupado";
  await domiciliario.save();

  pedido.domiciliario_id = domiciliario._id;
  await pedido.save();
  res.json(pedido);
};

module.exports = {
  crear,
  misPedidos,
  listar,
  obtener,
  cambiarEstado,
  cancelar,
  asignarDomiciliario,
};
