const { Router } = require("express");
const { auth, requireRole } = require("../../middleware/auth");
const { enTexto } = require("../../middleware/errores");
const { ROL } = require("../../utils/roles");

// Administración del restaurante (app de comandas): solo admin, errores en texto.
const router = Router();
router.use(enTexto, auth, requireRole(ROL.ADMIN));

router.use("/mesas", require("./mesas"));
router.use("/menu", require("./menu"));

const { insumosRouter, recetasRouter } = require("./inventario");
router.use("/insumos", insumosRouter);
router.use("/recetas", recetasRouter);

const { cajaRouter, reportesRouter } = require("./caja");
router.use("/caja", cajaRouter);
router.use("/reportes", reportesRouter);

const { personalRouter, pedidosRouter, auditoriaRouter } = require("./gestion");
router.use("/personal", personalRouter);
router.use("/pedidos", pedidosRouter);
router.use("/auditoria", auditoriaRouter);

module.exports = router;
