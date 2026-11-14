const { Router } = require("express");
const c = require("../controllers/reservaController");
const { auth, requireRole } = require("../middleware/auth");

const { auditar } = require("../middleware/auditar");
const { SERVICIO } = require("../services/auditoria");
const { codigoCorto } = require("../utils/codigo");
const { ROL } = require("../utils/roles");

const router = Router();

router.use(auth);

router.post("/", c.crear);
router.get("/mis-reservas", c.misReservas);
router.get("/", requireRole(ROL.ADMIN), c.listar);
router.patch("/:id", c.actualizar);
router.get("/:id", c.obtener);
router.patch("/:id/cancelar", c.cancelar);
router.patch("/:id/estado", requireRole(ROL.ADMIN), auditar(SERVICIO.RESERVAS, "CAMBIAR_ESTADO_RESERVA", (req, b) => `Reserva ${codigoCorto(req.params.id)}: ${b.estado_reserva}`), c.cambiarEstado);

module.exports = router;
