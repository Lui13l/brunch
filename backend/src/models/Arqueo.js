const mongoose = require("mongoose");

// Entrada o salida de efectivo de la caja que no es una venta (cambio, compras
// menores...). No se borra: se anula, para que el arqueo conserve su historia.
const movimientoCajaSchema = new mongoose.Schema({
  tipo: { type: String, required: true, enum: ["INGRESO", "EGRESO"] },
  concepto: { type: String, required: true, trim: true, maxlength: 255 },
  monto: {
    type: Number,
    required: true,
    validate: { validator: (v) => v > 0, message: "El monto debe ser mayor que 0" },
  },
  usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  anulado: { type: Boolean, default: false },
  fecha: { type: Date, default: Date.now },
});

// Turno de caja: se abre con una base, acumula ventas y movimientos, y al
// cerrarse congela lo esperado y lo contado.
const arqueoSchema = new mongoose.Schema(
  {
    estado: { type: String, enum: ["ABIERTO", "CERRADO"], default: "ABIERTO" },
    base_inicial: { type: Number, required: true, min: 0 },
    abierto_por: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cerrado_por: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    esperado_efectivo: { type: Number, default: null },
    esperado_tarjeta: { type: Number, default: null },
    esperado_transferencia: { type: Number, default: null },
    contado_efectivo: { type: Number, min: 0, default: null },
    contado_tarjeta: { type: Number, min: 0, default: null },
    contado_transferencia: { type: Number, min: 0, default: null },
    notas_apertura: { type: String, default: null },
    notas_cierre: { type: String, default: null },
    fecha_apertura: { type: Date, default: Date.now },
    fecha_cierre: { type: Date, default: null },
    movimientos: { type: [movimientoCajaSchema], default: [] },
  },
  { collection: "arqueos" }
);

// Solo puede haber una caja abierta en todo el restaurante.
arqueoSchema.index(
  { estado: 1 },
  { unique: true, partialFilterExpression: { estado: "ABIERTO" }, name: "una_caja_abierta" }
);
arqueoSchema.index({ estado: 1, fecha_apertura: -1 });

module.exports = mongoose.model("Arqueo", arqueoSchema);
