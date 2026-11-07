const { Router } = require("express");
const { validar, idParams } = require("../../utils/validar");
const c = require("../../controllers/mesaController");

const router = Router();

router.get("/", c.listarTodas);
router.post("/", validar(c.mesaSchema), c.crear);
router.put("/:id", validar(idParams, "params"), validar(c.mesaSchema), c.editar);
router.delete("/:id", validar(idParams, "params"), c.eliminar);

module.exports = router;
