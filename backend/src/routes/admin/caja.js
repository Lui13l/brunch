const { Router } = require("express");
const { validar, idParams } = require("../../utils/validar");
const caja = require("../../controllers/cajaController");
const reportes = require("../../controllers/reporteController");

const cajaRouter = Router();
cajaRouter.get("/", caja.actual);
cajaRouter.post("/abrir", validar(caja.abrirSchema), caja.abrir);
cajaRouter.post("/cerrar", validar(caja.cerrarSchema), caja.cerrar);
cajaRouter.post("/movimientos", validar(caja.movimientoSchema), caja.registrarMovimiento);
cajaRouter.delete("/movimientos/:id", validar(idParams, "params"), caja.anularMovimiento);
// Antes de "/:id" para que "historial" no se tome como identificador.
cajaRouter.get("/historial", caja.historial);
cajaRouter.get("/:id", validar(idParams, "params"), caja.detalle);

const reportesRouter = Router();
reportesRouter.get("/ventas", validar(reportes.rangoSchema, "query"), reportes.ventas);
reportesRouter.get("/consumo", validar(reportes.rangoSchema, "query"), reportes.consumo);

module.exports = { cajaRouter, reportesRouter };
