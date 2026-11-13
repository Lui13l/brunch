const { Router } = require("express");
const { validar, idParams } = require("../../utils/validar");
const c = require("../../controllers/menuAdminController");

const router = Router();

router.get("/", c.listar);
router.get("/audit", c.auditoria);
router.post("/", validar(c.platoSchema), c.crear);
router.put("/:id", validar(idParams, "params"), validar(c.platoSchema), c.editar);
router.delete("/:id", validar(idParams, "params"), c.eliminar);

module.exports = router;
