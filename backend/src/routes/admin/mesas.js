const { Router } = require("express");
const { validar, idParams } = require("../../utils/validar");
const c = require("../../controllers/mesaController");

const router = Router();

router.get("/", c.listarTodas);
router.post("/", validar(c.mesaSchema), c.crear);
// Va antes de "/:id": si no, "plano" se tomaría por el id de una mesa.
router.put("/plano", validar(c.planoSchema), c.guardarPlano);
router.put("/:id", validar(idParams, "params"), validar(c.mesaSchema), c.editar);
router.delete("/:id", validar(idParams, "params"), c.eliminar);

module.exports = router;
