const { Router } = require("express");
const c = require("../controllers/pedidoController");
const { auth, requireRole } = require("../middleware/auth");

const { auditar, codigo } = require("../middleware/auditar");

const router = Router();

router.use(auth);

router.post("/", c.crear);
router.get("/mis-pedidos", c.misPedidos);
router.get("/", requireRole("admin"), c.listar);
router.get("/:id", c.obtener);
router.patch("/:id/cancelar", c.cancelar);
router.patch("/:id/estado", requireRole("admin"), auditar("pedidos", "CAMBIAR_ESTADO_PEDIDO", (req, b) => `Pedido web ${codigo(req.params.id)}: ${b.estado}`), c.cambiarEstado);
router.patch("/:id/domiciliario", requireRole("admin"), auditar("pedidos", "ASIGNAR_DOMICILIARIO", (req) => `Asignó domiciliario al pedido web ${codigo(req.params.id)}`), c.asignarDomiciliario);

module.exports = router;
