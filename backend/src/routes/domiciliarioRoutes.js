const { Router } = require("express");
const c = require("../controllers/domiciliarioController");
const { auth, requireRole } = require("../middleware/auth");

const { auditar, codigo } = require("../middleware/auditar");

const nombre = (b) => [b.nombre, b.apellido].filter(Boolean).join(" ");

const router = Router();

router.use(auth, requireRole("admin"));

router.get("/", c.listar);
router.get("/:id", c.obtener);
router.post("/", auditar("pedidos", "CREAR_DOMICILIARIO", (req, b) => `Registró al domiciliario ${nombre(b)}`), c.crear);
router.put("/:id", auditar("pedidos", "EDITAR_DOMICILIARIO", (req, b) => `Editó al domiciliario ${nombre(b)}`), c.actualizar);
router.patch("/:id/estado", auditar("pedidos", "CAMBIAR_ESTADO_DOMICILIARIO", (req, b) => `Domiciliario ${nombre(b)}: ${b.estado}`), c.cambiarEstado);
router.delete("/:id", auditar("pedidos", "DESACTIVAR_DOMICILIARIO", (req, b) => `Desactivó al domiciliario ${nombre(b)}`), c.eliminar);

module.exports = router;
