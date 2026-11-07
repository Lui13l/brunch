const { Router } = require("express");
const { validar, idParams } = require("../../utils/validar");
const insumos = require("../../controllers/insumoController");
const recetas = require("../../controllers/recetaController");

const insumosRouter = Router();
insumosRouter.get("/", insumos.listar);
insumosRouter.post("/", validar(insumos.crearInsumoSchema), insumos.crear);
insumosRouter.put("/:id", validar(idParams, "params"), validar(insumos.editarInsumoSchema), insumos.editar);
insumosRouter.delete("/:id", validar(idParams, "params"), insumos.eliminar);
insumosRouter.post("/:id/ajuste", validar(idParams, "params"), validar(insumos.ajusteSchema), insumos.ajustar);
insumosRouter.get("/:id/movimientos", validar(idParams, "params"), insumos.movimientos);

const recetasRouter = Router();
// Antes de "/:id" para que "faltantes" no se tome como identificador.
recetasRouter.get("/faltantes", recetas.faltantes);
recetasRouter.get("/:id", validar(idParams, "params"), recetas.obtener);
recetasRouter.put("/:id", validar(idParams, "params"), validar(recetas.recetaSchema), recetas.guardar);

module.exports = { insumosRouter, recetasRouter };
