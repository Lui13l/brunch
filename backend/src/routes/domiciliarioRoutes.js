const { Router } = require("express");
const c = require("../controllers/domiciliarioController");
const { auth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(auth, requireRole("admin"));

router.get("/", c.listar);
router.get("/:id", c.obtener);
router.post("/", c.crear);
router.put("/:id", c.actualizar);
router.patch("/:id/estado", c.cambiarEstado);
router.delete("/:id", c.eliminar);

module.exports = router;
