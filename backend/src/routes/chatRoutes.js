const { Router } = require("express");
const c = require("../controllers/chatController");
const { auth, authOpcional, requireRole } = require("../middleware/auth");
const { limiteChat } = require("../middleware/limites");

const { auditar } = require("../middleware/auditar");
const { SERVICIO } = require("../services/auditoria");
const { codigoCorto } = require("../utils/codigo");
const { ROL } = require("../utils/roles");

const router = Router();

// Abierto a visitantes: con sesión se guarda la conversación, sin sesión solo se responde.
router.post("/mensaje", authOpcional, limiteChat, c.enviarMensaje);

router.use(auth);

router.get("/conversaciones", c.listarConversaciones);
router.get("/conversaciones/:id", c.obtenerConversacionPorId);
router.patch("/conversaciones/:id/finalizar", c.finalizarConversacion);

router.get("/intenciones", requireRole(ROL.ADMIN), c.listarIntenciones);
router.post("/intenciones", requireRole(ROL.ADMIN), auditar(SERVICIO.CHATBOT, "CREAR_INTENCION", (req, b) => `Creó la intención "${b.nombre}"`), c.crearIntencion);
router.put("/intenciones/:id", requireRole(ROL.ADMIN), auditar(SERVICIO.CHATBOT, "EDITAR_INTENCION", (req, b) => `Editó la intención "${b.nombre}"`), c.actualizarIntencion);
router.delete("/intenciones/:id", requireRole(ROL.ADMIN), auditar(SERVICIO.CHATBOT, "ELIMINAR_INTENCION", (req) => `Eliminó la intención ${codigoCorto(req.params.id)}`), c.eliminarIntencion);

module.exports = router;
