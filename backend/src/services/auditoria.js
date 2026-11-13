const { AuditLog } = require("../models");

const SERVICIO = Object.freeze({
  MENU: "menu",
  PEDIDOS: "pedidos",
  INVENTARIO: "inventario",
  COMANDAS: "comandas",
  CAJA: "caja",
  PERSONAL: "personal",
  RESERVAS: "reservas",
  CHATBOT: "chatbot",
});

// Registra una acción. Es "mejor esfuerzo": si falla no tumba la operación,
// que ya se hizo. Se llama después de confirmar los cambios.
const registrar = async (usuario, accion, detalle, servicio) => {
  try {
    await AuditLog.create({
      accion,
      detalle: String(detalle).slice(0, 500),
      servicio,
      usuario_id: usuario?._id ?? null,
      usuario_nombre: usuario?.nombre ?? null,
      usuario_rol: usuario?.rol_id ?? null,
    });
  } catch (error) {
    console.error(`No se pudo auditar ${accion}:`, error.message);
  }
};

const listar = async ({ servicio, usuarioId, desde, hasta, limite = 100 } = {}) => {
  const filtro = {};
  if (servicio) filtro.servicio = servicio;
  if (usuarioId) filtro.usuario_id = usuarioId;
  if (desde || hasta) {
    filtro.fecha = {};
    if (desde) filtro.fecha.$gte = desde;
    if (hasta) filtro.fecha.$lt = hasta;
  }
  return AuditLog.find(filtro).sort({ fecha: -1, _id: -1 }).limit(limite).lean();
};

module.exports = { SERVICIO, registrar, listar };
