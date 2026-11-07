const { Router } = require("express");
const c = require("../controllers/usuarioController");
const { auth, requireRole } = require("../middleware/auth");
const { enTexto } = require("../middleware/errores");
const { limiteAuth } = require("../middleware/limites");
const sesion = require("../controllers/sesionPersonalController");

const { auditar, codigo } = require("../middleware/auditar");
const { toUsuarioPersonal } = require("../utils/serializar");

const router = Router();

// Login de la app de comandas (personal). Responde errores en texto plano.
router.post("/login", enTexto, limiteAuth, sesion.loginPersonal);
router.put("/perfil", auth, c.actualizarPerfil);
// Usuario de la sesión con el contrato del personal: la app de comandas lo usa
// para abrir sesión con el token que le pasa el panel de admin de la web.
router.get("/yo", enTexto, auth, (req, res) => res.json(toUsuarioPersonal(req.usuario)));
router.get("/", auth, requireRole("admin"), c.listar);
router.get("/:id", auth, requireRole("admin"), c.obtener);
router.patch("/:id/rol", auth, requireRole("admin"), auditar("personal", "CAMBIAR_ROL", (req, b) => `Cambió el rol de ${b.correo} a ${b.rol_id}`), c.cambiarRol);

module.exports = router;
