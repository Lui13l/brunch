const { Router } = require("express");
const c = require("../controllers/reservaController");
const { auth, requireRole } = require("../middleware/auth");

const { auditar, codigo } = require("../middleware/auditar");

const router = Router();

router.use(auth);

router.post("/", c.crear);
router.get("/mis-reservas", c.misReservas);
router.get("/", requireRole("admin"), c.listar);
router.get("/:id", c.obtener);
router.patch("/:id/cancelar", c.cancelar);
router.patch("/:id/estado", requireRole("admin"), auditar("reservas", "CAMBIAR_ESTADO_RESERVA", (req, b) => `Reserva ${codigo(req.params.id)}: ${b.estado_reserva}`), c.cambiarEstado);

module.exports = router;
