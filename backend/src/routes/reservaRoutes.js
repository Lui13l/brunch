const { Router } = require("express");
const c = require("../controllers/reservaController");
const { auth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(auth);

router.post("/", c.crear);
router.get("/mis-reservas", c.misReservas);
router.get("/", requireRole("admin"), c.listar);
router.get("/:id", c.obtener);
router.patch("/:id/cancelar", c.cancelar);
router.patch("/:id/estado", requireRole("admin"), c.cambiarEstado);

module.exports = router;
