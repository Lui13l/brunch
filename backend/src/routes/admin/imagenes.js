const express = require("express");
const { Imagen } = require("../../models");
const { LIMITE_BYTES } = require("../../services/imagenes");
const c = require("../../controllers/imagenController");

const router = express.Router();

// El cuerpo es la imagen misma. Con otro Content-Type no se lee nada y el
// controlador responde 400.
router.post("/", express.raw({ type: Imagen.TIPOS_IMAGEN, limit: LIMITE_BYTES }), c.subir);

module.exports = router;
