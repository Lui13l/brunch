const { Router } = require("express");
const c = require("../controllers/productoController");
const { auth, authOpcional, requireRole } = require("../middleware/auth");

const { auditar, codigo } = require("../middleware/auditar");

const router = Router();

router.get("/", authOpcional, c.listar);
router.get("/:id", authOpcional, c.obtener);
router.post("/", auth, requireRole("admin"), auditar("menu", "CREAR_PRODUCTO", (req, b) => `Creó el producto "${b.nombre}"`), c.crear);
router.put("/:id", auth, requireRole("admin"), auditar("menu", "EDITAR_PRODUCTO", (req, b) => `Editó el producto "${b.nombre}"`), c.actualizar);
router.delete("/:id", auth, requireRole("admin"), auditar("menu", "DESACTIVAR_PRODUCTO", (req, b) => `Desactivó el producto "${b.nombre}"`), c.eliminar);

module.exports = router;
