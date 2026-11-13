// Código corto y legible de un id de Mongo para mensajes y auditoría: "#2A04EA".
const codigoCorto = (id) => `#${String(id ?? "").slice(-6).toUpperCase()}`;

module.exports = { codigoCorto };
