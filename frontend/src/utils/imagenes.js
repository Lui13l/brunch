import { ORIGEN_API } from "../api/api";

// Las fotos de la carta original son archivos de la web ("/menu/pancakes.jpg");
// las subidas desde el panel viven en el backend ("/api/imagenes/…"), que en
// desarrollo y en producción puede estar en otro origen.
export const urlImagen = (ruta) => (ruta?.startsWith("/api/") ? `${ORIGEN_API}${ruta}` : ruta);

// Lado más largo de la foto ya reducida: sobra para una tarjeta del menú y deja
// el archivo en unos 100-300 KB. Las fotos se guardan en la base de datos.
// (La app del personal tiene esta misma función en personal/src/lib/imagenes.js.)
const LADO_MAXIMO = 1200;

const cargarImagen = (url) =>
  new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => reject(new Error("No se pudo leer la imagen. Prueba con otra."));
    imagen.src = url;
  });

const aBlob = (lienzo, tipo, calidad) => new Promise((resolve) => lienzo.toBlob(resolve, tipo, calidad));

// Reduce una foto elegida del computador antes de subirla.
export async function reducirImagen(archivo) {
  if (!archivo.type.startsWith("image/")) throw new Error("Elige un archivo de imagen (JPG, PNG o WebP).");

  const url = URL.createObjectURL(archivo);
  try {
    const imagen = await cargarImagen(url);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
    lienzo.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
    lienzo.getContext("2d").drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

    // Un navegador que no sabe escribir WebP devuelve PNG, que pesa mucho más:
    // en ese caso se usa JPEG.
    let blob = await aBlob(lienzo, "image/webp", 0.82);
    if (blob?.type !== "image/webp") blob = await aBlob(lienzo, "image/jpeg", 0.85);
    if (!blob) throw new Error("No se pudo preparar la imagen. Prueba con otra.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
