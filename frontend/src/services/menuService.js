import { api } from "../api/api";
import { urlImagen } from "../utils/imagenes";

// Carta pública (solo lo activo y visible en la web). Las fotos salen con la
// dirección completa, lista para un <img>: el menú, los favoritos y el carrito
// no tienen que saber dónde vive cada una.
export const listarProductos = async () =>
  (await api.get("/productos")).map((producto) => ({ ...producto, img_url: urlImagen(producto.img_url) }));
