const { Router } = require("express");
const c = require("../controllers/pagoController");
const { auth, requireRole } = require("../middleware/auth");

const { auditar, codigo } = require("../middleware/auditar");

const router = Router();

router.use(auth);

router.post("/", c.crear);
router.get("/", requireRole("admin"), c.listar);
router.get("/:id", c.obtener);
router.patch("/:id/estado", requireRole("admin"), auditar("pedidos", "CAMBIAR_ESTADO_PAGO", (req, b) => `Pago ${codigo(req.params.id)}: ${b.estado}`), c.cambiarEstado);

module.exports = router;
