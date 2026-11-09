const { Router } = require("express");
const c = require("../controllers/domiciliarioController");
const { auth, requireRole } = require("../middleware/auth");

const { auditar } = require("../middleware/auditar");
const { SERVICIO } = require("../services/auditoria");
const { ROL } = require("../utils/roles");

const nombre = (b) => [b.nombre, b.apellido].filter(Boolean).join(" ");

const router = Router();

router.use(auth, requireRole(ROL.ADMIN));

router.get("/", c.listar);
router.get("/:id", c.obtener);
router.post("/", auditar(SERVICIO.PEDIDOS, "CREAR_DOMICILIARIO", (req, b) => `Registró al domiciliario ${nombre(b)}`), c.crear);
router.put("/:id", auditar(SERVICIO.PEDIDOS, "EDITAR_DOMICILIARIO", (req, b) => `Editó al domiciliario ${nombre(b)}`), c.actualizar);
router.patch("/:id/estado", auditar(SERVICIO.PEDIDOS, "CAMBIAR_ESTADO_DOMICILIARIO", (req, b) => `Domiciliario ${nombre(b)}: ${b.estado}`), c.cambiarEstado);
router.delete("/:id", auditar(SERVICIO.PEDIDOS, "DESACTIVAR_DOMICILIARIO", (req, b) => `Desactivó al domiciliario ${nombre(b)}`), c.eliminar);

module.exports = router;
