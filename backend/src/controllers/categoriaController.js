const { Category, MenuItem } = require("../models");
const { HttpError, pick } = require("../utils/http");

const listar = async (req, res) => {
  const categorias = await Category.find().sort({ orden: 1, nombre: 1 });
  res.json(categorias);
};

const crear = async (req, res) => {
  const categoria = await Category.create(pick(req.body, ["nombre", "orden"]));
  res.status(201).json(categoria);
};

const actualizar = async (req, res) => {
  const categoria = await Category.findByIdAndUpdate(
    req.params.id,
    pick(req.body, ["nombre", "orden"]),
    { returnDocument: "after", runValidators: true }
  );
  if (!categoria) throw new HttpError(404, "Categoría no encontrada");
  res.json(categoria);
};

const eliminar = async (req, res) => {
  if (await MenuItem.exists({ categoria_id: req.params.id })) {
    throw new HttpError(409, "No se puede eliminar: hay productos en esta categoría");
  }

  const categoria = await Category.findByIdAndDelete(req.params.id);
  if (!categoria) throw new HttpError(404, "Categoría no encontrada");
  res.status(204).end();
};

module.exports = { listar, crear, actualizar, eliminar };
