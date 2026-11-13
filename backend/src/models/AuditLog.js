const mongoose = require("mongoose");

const SERVICIOS = ["menu", "pedidos", "inventario", "comandas", "caja", "personal", "reservas", "chatbot"];

// Historial de acciones del personal. Guarda una copia del nombre y rol del
// usuario para que el registro siga siendo legible aunque la cuenta cambie.
const auditLogSchema = new mongoose.Schema(
  {
    accion: { type: String, required: true, trim: true },
    detalle: { type: String, required: true, maxlength: 500 },
    servicio: { type: String, required: true, enum: SERVICIOS },
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    usuario_nombre: { type: String, default: null },
    usuario_rol: { type: String, default: null },
    fecha: { type: Date, default: Date.now },
  },
  { collection: "audit_logs" }
);

auditLogSchema.index({ fecha: -1 });
auditLogSchema.index({ servicio: 1, fecha: -1 });
auditLogSchema.index({ usuario_id: 1, fecha: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
AuditLog.SERVICIOS = SERVICIOS;

module.exports = AuditLog;
