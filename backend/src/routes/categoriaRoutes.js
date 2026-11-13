const { Router } = require("express");
const c = require("../controllers/categoriaController");
const { auth, requireRole } = require("../middleware/auth");

const { auditar } = require("../middleware/auditar");
const { SERVICIO } = require("../services/auditoria");
const { codigoCorto } = require("../utils/codigo");
const { ROL } = require("../utils/roles");

const router = Router();

router.get("/", c.listar);
router.post("/", auth, requireRole(ROL.ADMIN), auditar(SERVICIO.MENU, "CREAR_CATEGORIA", (req, b) => `Creó la categoría "${b.nombre}"`), c.crear);
router.put("/:id", auth, requireRole(ROL.ADMIN), auditar(SERVICIO.MENU, "EDITAR_CATEGORIA", (req, b) => `Editó la categoría "${b.nombre}"`), c.actualizar);
router.delete("/:id", auth, requireRole(ROL.ADMIN), auditar(SERVICIO.MENU, "ELIMINAR_CATEGORIA", (req) => `Eliminó la categoría ${codigoCorto(req.params.id)}`), c.eliminar);

module.exports = router;
