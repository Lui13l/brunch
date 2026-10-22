const { Router } = require("express");
const c = require("../controllers/productoController");
const { auth, authOpcional, requireRole } = require("../middleware/auth");

const router = Router();

router.get("/", authOpcional, c.listar);
router.get("/:id", authOpcional, c.obtener);
router.post("/", auth, requireRole("admin"), c.crear);
router.put("/:id", auth, requireRole("admin"), c.actualizar);
router.delete("/:id", auth, requireRole("admin"), c.eliminar);

module.exports = router;
