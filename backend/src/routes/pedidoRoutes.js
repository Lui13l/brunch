const { Router } = require("express");
const c = require("../controllers/pedidoController");
const { auth, requireRole } = require("../middleware/auth");

const { auditar } = require("../middleware/auditar");
const { SERVICIO } = require("../services/auditoria");
const { codigoCorto } = require("../utils/codigo");
const { ROL } = require("../utils/roles");

const router = Router();

router.use(auth);

router.post("/", c.crear);
router.get("/mis-pedidos", c.misPedidos);
router.get("/", requireRole(ROL.ADMIN), c.listar);
router.get("/:id", c.obtener);
router.patch("/:id/cancelar", c.cancelar);
router.patch("/:id/estado", requireRole(ROL.ADMIN), auditar(SERVICIO.PEDIDOS, "CAMBIAR_ESTADO_PEDIDO", (req, b) => `Pedido web ${codigoCorto(req.params.id)}: ${b.estado}`), c.cambiarEstado);
router.patch("/:id/domiciliario", requireRole(ROL.ADMIN), auditar(SERVICIO.PEDIDOS, "ASIGNAR_DOMICILIARIO", (req) => `Asignó domiciliario al pedido web ${codigoCorto(req.params.id)}`), c.asignarDomiciliario);

module.exports = router;
