const { Router } = require("express");
const { validar, idParams } = require("../../utils/validar");
const personal = require("../../controllers/personalController");
const pedidos = require("../../controllers/pedidoAdminController");
const auditoria = require("../../controllers/auditoriaController");

const personalRouter = Router();
personalRouter.get("/", validar(personal.listarSchema, "query"), personal.listar);
personalRouter.post("/", validar(personal.crearSchema), personal.crear);
personalRouter.patch("/:id/rol", validar(idParams, "params"), validar(personal.rolSchema), personal.cambiarRol);
personalRouter.patch("/:id/activo", validar(idParams, "params"), validar(personal.activoSchema), personal.cambiarActivo);
personalRouter.patch("/:id/password", validar(idParams, "params"), validar(personal.passwordSchema), personal.cambiarPassword);

const pedidosRouter = Router();
pedidosRouter.get("/", validar(pedidos.listarSchema, "query"), pedidos.listar);
pedidosRouter.patch("/:id/estado", validar(idParams, "params"), validar(pedidos.estadoSchema), pedidos.cambiarEstado);

const auditoriaRouter = Router();
auditoriaRouter.get("/", validar(auditoria.listarSchema, "query"), auditoria.listar);

module.exports = { personalRouter, pedidosRouter, auditoriaRouter };
