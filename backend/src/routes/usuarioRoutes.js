const { Router } = require("express");
const c = require("../controllers/usuarioController");
const { auth, requireRole } = require("../middleware/auth");

const router = Router();

router.put("/perfil", auth, c.actualizarPerfil);
router.get("/", auth, requireRole("admin"), c.listar);
router.get("/:id", auth, requireRole("admin"), c.obtener);
router.patch("/:id/rol", auth, requireRole("admin"), c.cambiarRol);

module.exports = router;
