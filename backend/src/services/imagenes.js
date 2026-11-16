const { Imagen, MenuItem } = require("../models");

// Tope de lo que se guarda. El navegador reduce la foto antes de enviarla
// (unos 100-300 KB), así que esto solo frena un envío hecho a mano.
const LIMITE_BYTES = 1024 * 1024;

const urlDeImagen = (id) => `/api/imagenes/${id}`;
const ES_URL_PROPIA = /^\/api\/imagenes\/([a-f\d]{24})$/i;

// El tipo se lee de los primeros bytes, no de la cabecera que mande el cliente:
// así no se guarda (ni se sirve después como imagen) algo que no lo es.
const tipoPorContenido = (datos) => {
  if (datos.length < 12) return null;
  if (datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) return "image/jpeg";
  if (datos.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (datos.toString("latin1", 0, 4) === "RIFF" && datos.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
};

// Al cambiar la foto de un plato, la anterior se borra si era una subida y ya
// ningún plato la usa. Las rutas de la carta original (/menu/...) no se tocan.
// Nunca lanza: es limpieza, no debe tumbar el guardado que ya se hizo.
const borrarSiNadieLaUsa = async (url) => {
  try {
    const id = ES_URL_PROPIA.exec(url ?? "")?.[1];
    if (!id) return;
    if (await MenuItem.exists({ img_url: url })) return;
    await Imagen.deleteOne({ _id: id });
  } catch (error) {
    console.error("No se pudo borrar la imagen anterior:", error.message);
  }
};

module.exports = { LIMITE_BYTES, urlDeImagen, tipoPorContenido, borrarSiNadieLaUsa };
