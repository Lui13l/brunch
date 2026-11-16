const mongoose = require("mongoose");

const ESTADOS_ENVIO = ["sin_enviar", "enviada", "error"];

const lineaSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    cantidad: { type: Number, required: true },
    precio_unitario: { type: Number, required: true },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

// Comprobante de un pedido web. No es una factura electrónica ante la DIAN.
//
// Guarda una copia de lo que se cobró y a quién: el PDF se arma con esto cada
// vez que se pide, así que no cambia aunque después se edite el pedido, la
// carta o el perfil del cliente.
const facturaSchema = new mongoose.Schema(
  {
    // Consecutivo del restaurante (1, 2, 3…). Se muestra como "BC-000001".
    numero: { type: Number, required: true, unique: true },
    // Un pedido tiene, como mucho, un comprobante.
    pedido_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cliente: {
      nombre: { type: String, default: "" },
      correo: { type: String, default: "" },
      direccion: { type: String, default: "" },
      celular: { type: String, default: "" },
    },
    items: { type: [lineaSchema], default: [] },
    total: { type: Number, required: true },
    metodo_pago: { type: String, default: null },
    fecha_pedido: { type: Date, default: null },
    fecha_emision: { type: Date, default: Date.now },
    envio: {
      estado: { type: String, enum: ESTADOS_ENVIO, default: "sin_enviar" },
      // Por qué no salió (sin clave de correo, rechazo del proveedor…).
      detalle: { type: String, default: null },
      fecha: { type: Date, default: null },
      intentos: { type: Number, default: 0 },
    },
  },
  { collection: "facturas" }
);

facturaSchema.index({ fecha_emision: -1 });

// Consecutivos que no se pueden repetir. Uno por documento: { _id: "factura", valor }.
const contadorSchema = new mongoose.Schema(
  { _id: { type: String }, valor: { type: Number, default: 0 } },
  { collection: "contadores" }
);

const Factura = mongoose.model("Factura", facturaSchema);
const Contador = mongoose.model("Contador", contadorSchema);
Object.assign(Factura, { ESTADOS_ENVIO, Contador });

module.exports = Factura;
