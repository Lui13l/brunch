const { Router } = require("express");
const c = require("../controllers/pedidoController");
const { auth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(auth);

router.post("/", c.crear);
router.get("/mis-pedidos", c.misPedidos);
router.get("/", requireRole("admin"), c.listar);
router.get("/:id", c.obtener);
router.patch("/:id/cancelar", c.cancelar);
router.patch("/:id/estado", requireRole("admin"), c.cambiarEstado);
router.patch("/:id/domiciliario", requireRole("admin"), c.asignarDomiciliario);

module.exports = router;
