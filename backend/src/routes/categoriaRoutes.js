const { Router } = require("express");
const c = require("../controllers/categoriaController");
const { auth, requireRole } = require("../middleware/auth");

const { auditar, codigo } = require("../middleware/auditar");

const router = Router();

router.get("/", c.listar);
router.post("/", auth, requireRole("admin"), auditar("menu", "CREAR_CATEGORIA", (req, b) => `Creó la categoría "${b.nombre}"`), c.crear);
router.put("/:id", auth, requireRole("admin"), auditar("menu", "EDITAR_CATEGORIA", (req, b) => `Editó la categoría "${b.nombre}"`), c.actualizar);
router.delete("/:id", auth, requireRole("admin"), auditar("menu", "ELIMINAR_CATEGORIA", (req) => `Eliminó la categoría ${codigo(req.params.id)}`), c.eliminar);

module.exports = router;
