const { Router } = require("express");
const c = require("../controllers/chatController");
const { auth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(auth);

router.post("/mensaje", c.enviarMensaje);

router.get("/conversaciones", c.listarConversaciones);
router.get("/conversaciones/:id", c.obtenerConversacionPorId);
router.patch("/conversaciones/:id/finalizar", c.finalizarConversacion);

router.get("/intenciones", requireRole("admin"), c.listarIntenciones);
router.post("/intenciones", requireRole("admin"), c.crearIntencion);
router.put("/intenciones/:id", requireRole("admin"), c.actualizarIntencion);
router.delete("/intenciones/:id", requireRole("admin"), c.eliminarIntencion);

module.exports = router;
