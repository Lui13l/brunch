const { Imagen } = require("../models");
const { HttpError } = require("../utils/http");
const { registrar, SERVICIO } = require("../services/auditoria");
const { urlDeImagen, tipoPorContenido } = require("../services/imagenes");

// La imagen llega como cuerpo binario (no JSON): la ruta la lee con express.raw.
const subir = async (req, res) => {
  const datos = req.body;
  const tipo = Buffer.isBuffer(datos) ? tipoPorContenido(datos) : null;
  if (!tipo) throw new HttpError(400, "Envía una imagen en formato WebP, JPEG o PNG");

  const imagen = await Imagen.create({ tipo, datos, tamano: datos.length, subida_por: req.usuario._id });
  await registrar(
    req.usuario,
    "SUBIR_IMAGEN",
    `Subió una imagen de ${Math.round(datos.length / 1024)} KB`,
    SERVICIO.MENU
  );
  res.status(201).json({ id: String(imagen._id), url: urlDeImagen(imagen._id) });
};

// Pública: la carta de la web la muestra sin sesión.
const ver = async (req, res) => {
  const imagen = await Imagen.findById(req.valid.params.id);
  if (!imagen) throw new HttpError(404, "Imagen no encontrada");

  res.set({
    "Content-Type": imagen.tipo,
    // Una imagen nunca cambia: una foto nueva es otro id y otra URL.
    "Cache-Control": "public, max-age=31536000, immutable",
    // La web corre en otro origen que la API; sin esto el navegador la bloquea.
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  res.send(imagen.datos);
};

module.exports = { subir, ver };
