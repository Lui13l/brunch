const { z } = require("zod");
const { Factura, Order } = require("../models");
const { HttpError } = require("../utils/http");
const { objectId } = require("../utils/validar");
const facturas = require("../services/facturas");

// Panel de comprobantes de la web (solo admin).

const generarSchema = z.object({ pedidoId: objectId });
const listarSchema = z.object({ estado: z.enum(Factura.ESTADOS_ENVIO, { error: "Estado de envío no válido" }).optional() });

const TOPE = 200;

const aJson = (f) => ({
  id: String(f._id),
  numero: facturas.numeroLegible(f.numero),
  pedidoId: String(f.pedido_id),
  cliente: { nombre: f.cliente?.nombre ?? "", correo: f.cliente?.correo ?? "" },
  total: f.total,
  metodoPago: f.metodo_pago ?? null,
  fechaEmision: f.fecha_emision,
  envio: {
    estado: f.envio?.estado ?? "sin_enviar",
    detalle: f.envio?.detalle ?? null,
    fecha: f.envio?.fecha ?? null,
    intentos: f.envio?.intentos ?? 0,
  },
});

const buscar = async (id) => {
  const factura = await Factura.findById(id);
  if (!factura) throw new HttpError(404, "Comprobante no encontrado");
  return factura;
};

const listar = async (req, res) => {
  const { estado } = req.valid.query;
  const lista = await Factura.find(estado ? { "envio.estado": estado } : {})
    .sort({ numero: -1 })
    .limit(TOPE)
    .lean();
  res.json(lista.map(aJson));
};

// Pedidos entregados que todavía no tienen comprobante: los que se pagaron en
// efectivo o con tarjeta, o los que se entregaron antes de aprobar el pago.
const pendientes = async (req, res) => {
  const conFactura = await Factura.distinct("pedido_id");
  const pedidos = await Order.find({ estado: "entregado", _id: { $nin: conFactura } })
    .sort({ updatedAt: -1 })
    .limit(50)
    .populate("usuario_id", "nombre correo")
    .lean();
  res.json(
    pedidos.map((p) => ({
      pedidoId: String(p._id),
      cliente: { nombre: p.usuario_id?.nombre ?? "", correo: p.usuario_id?.correo ?? "" },
      total: p.total,
      fecha: p.updatedAt ?? p.fecha_inicio,
    }))
  );
};

// Genera el comprobante de un pedido entregado y lo envía. Si ya existía,
// responde ese mismo sin volver a enviarlo (para eso está "reenviar").
const generar = async (req, res) => {
  const { pedidoId } = req.valid.body;
  const existia = await Factura.exists({ pedido_id: pedidoId });
  const factura = await facturas.emitir(pedidoId);
  res.status(existia ? 200 : 201).json(aJson(existia ? factura : await facturas.enviar(factura)));
};

const reenviar = async (req, res) => {
  const factura = await buscar(req.valid.params.id);
  res.json(aJson(await facturas.enviar(factura)));
};

const pdf = async (req, res) => {
  const factura = await buscar(req.valid.params.id);
  const datos = await facturas.generarPdf(factura);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${facturas.nombreArchivo(factura)}"`,
    // Tiene datos del cliente: que no quede en cachés compartidas.
    "Cache-Control": "private, no-store",
  });
  res.send(datos);
};

module.exports = { generarSchema, listarSchema, listar, pendientes, generar, reenviar, pdf };
