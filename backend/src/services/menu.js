const { MenuItem } = require("../models");
const { HttpError } = require("../utils/http");

// Eliminar un producto = desactivarlo. Los pedidos y comandas viejos lo siguen
// referenciando, y su receta se conserva por si se vuelve a activar.
// Lo usan la web (/productos) y el panel/app del personal (/admin/menu).
const desactivarProducto = async (id) => {
  const producto = await MenuItem.findByIdAndUpdate(id, { activo: false }, { returnDocument: "after" });
  if (!producto) throw new HttpError(404, "Producto no encontrado");
  return producto;
};

module.exports = { desactivarProducto };
