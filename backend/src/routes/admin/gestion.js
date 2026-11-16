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
pedidosRouter.patch("/:id/domiciliario", validar(idParams, "params"), validar(pedidos.asignarSchema), pedidos.asignarDomiciliario);

// Quién puede llevar un pedido web. La ficha completa de cada domiciliario
// (editar, desactivar) sigue en el panel de la web.
const domiciliariosRouter = Router();
domiciliariosRouter.get("/", pedidos.listarDomiciliarios);
domiciliariosRouter.post("/", validar(pedidos.domiciliarioSchema), pedidos.crearDomiciliario);

const auditoriaRouter = Router();
auditoriaRouter.get("/", validar(auditoria.listarSchema, "query"), auditoria.listar);

module.exports = { personalRouter, pedidosRouter, domiciliariosRouter, auditoriaRouter };
