const { z } = require("zod");
const { AuditLog } = require("../models");
const { objectId, fecha } = require("../utils/validar");
const { toAuditLog } = require("../utils/serializar");
const { rangoLocal } = require("../utils/tiempo");
const { listar: listarAuditoria } = require("../services/auditoria");

const listarSchema = z.object({
  servicio: z.enum(AuditLog.SERVICIOS, { error: "Servicio inválido" }).optional(),
  usuarioId: objectId.optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
  limite: z.coerce
    .number({ error: "El límite debe ser un número" })
    .int("El límite debe ser entero")
    .min(1, "El límite mínimo es 1")
    .max(500, "El límite máximo es 500")
    .default(100),
});

// Historial de acciones del personal, del más reciente al más antiguo.
const listar = async (req, res) => {
  const { servicio, usuarioId, desde, hasta, limite } = req.valid.query;
  const { inicio, fin } = rangoLocal(desde, hasta);
  const logs = await listarAuditoria({ servicio, usuarioId, desde: inicio, hasta: fin, limite });
  res.json(logs.map(toAuditLog));
};

module.exports = { listarSchema, listar };
