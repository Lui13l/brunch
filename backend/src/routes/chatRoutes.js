const { Router } = require("express");
const c = require("../controllers/chatController");
const { auth, authOpcional, requireRole } = require("../middleware/auth");
const { limiteChat } = require("../middleware/limites");

const router = Router();

// Abierto a visitantes: con sesión se guarda la conversación, sin sesión solo se responde.
router.post("/mensaje", authOpcional, limiteChat, c.enviarMensaje);

router.use(auth);

router.get("/conversaciones", c.listarConversaciones);
router.get("/conversaciones/:id", c.obtenerConversacionPorId);
router.patch("/conversaciones/:id/finalizar", c.finalizarConversacion);

router.get("/intenciones", requireRole("admin"), c.listarIntenciones);
router.post("/intenciones", requireRole("admin"), c.crearIntencion);
router.put("/intenciones/:id", requireRole("admin"), c.actualizarIntencion);
router.delete("/intenciones/:id", requireRole("admin"), c.eliminarIntencion);

module.exports = router;
