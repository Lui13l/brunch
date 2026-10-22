const { Router } = require("express");
const c = require("../controllers/categoriaController");
const { auth, requireRole } = require("../middleware/auth");

const router = Router();

router.get("/", c.listar);
router.post("/", auth, requireRole("admin"), c.crear);
router.put("/:id", auth, requireRole("admin"), c.actualizar);
router.delete("/:id", auth, requireRole("admin"), c.eliminar);

module.exports = router;
