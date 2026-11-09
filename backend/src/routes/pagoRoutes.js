const { Router } = require("express");
const c = require("../controllers/pagoController");
const { auth, requireRole } = require("../middleware/auth");

const { auditar } = require("../middleware/auditar");
const { SERVICIO } = require("../services/auditoria");
const { codigoCorto } = require("../utils/codigo");
const { ROL } = require("../utils/roles");

const router = Router();

router.use(auth);

router.post("/", c.crear);
router.get("/", requireRole(ROL.ADMIN), c.listar);
router.get("/:id", c.obtener);
router.patch("/:id/estado", requireRole(ROL.ADMIN), auditar(SERVICIO.PEDIDOS, "CAMBIAR_ESTADO_PAGO", (req, b) => `Pago ${codigoCorto(req.params.id)}: ${b.estado}`), c.cambiarEstado);

module.exports = router;
