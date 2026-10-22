const { Router } = require("express");
const c = require("../controllers/pagoController");
const { auth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(auth);

router.post("/", c.crear);
router.get("/", requireRole("admin"), c.listar);
router.get("/:id", c.obtener);
router.patch("/:id/estado", requireRole("admin"), c.cambiarEstado);

module.exports = router;
