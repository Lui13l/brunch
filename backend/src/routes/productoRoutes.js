const { Router } = require("express");
const c = require("../controllers/productoController");
const { auth, authOpcional, requireRole } = require("../middleware/auth");

const { auditar } = require("../middleware/auditar");
const { SERVICIO } = require("../services/auditoria");
const { ROL } = require("../utils/roles");

const router = Router();

router.get("/", authOpcional, c.listar);
router.get("/:id", authOpcional, c.obtener);
router.post("/", auth, requireRole(ROL.ADMIN), auditar(SERVICIO.MENU, "CREAR_PRODUCTO", (req, b) => `Creó el producto "${b.nombre}"`), c.crear);
router.put("/:id", auth, requireRole(ROL.ADMIN), auditar(SERVICIO.MENU, "EDITAR_PRODUCTO", (req, b) => `Editó el producto "${b.nombre}"`), c.actualizar);
router.delete("/:id", auth, requireRole(ROL.ADMIN), auditar(SERVICIO.MENU, "DESACTIVAR_PRODUCTO", (req, b) => `Desactivó el producto "${b.nombre}"`), c.eliminar);

module.exports = router;
