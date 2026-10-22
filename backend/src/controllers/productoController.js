const { MenuItem, Category } = require("../models");
const { HttpError, pick } = require("../utils/http");
const { esAdmin } = require("../middleware/auth");

const CAMPOS = ["tipo", "nombre", "descripcion", "precio", "categoria_id", "img_url", "activo"];

const validarCategoria = async (categoriaId) => {
  if (categoriaId !== undefined && !(await Category.exists({ _id: categoriaId }))) {
    throw new HttpError(400, "La categoría indicada no existe");
  }
};

// Público: solo productos activos. Un admin puede pedir ?incluir_inactivos=true.
const listar = async (req, res) => {
  const filtro = {};
  if (req.query.categoria) filtro.categoria_id = req.query.categoria;
  if (req.query.tipo) filtro.tipo = req.query.tipo;
  if (!(esAdmin(req) && req.query.incluir_inactivos === "true")) filtro.activo = true;

  const productos = await MenuItem.find(filtro)
    .populate("categoria_id", "nombre")
    .sort({ nombre: 1 });
  res.json(productos);
};

const obtener = async (req, res) => {
  const producto = await MenuItem.findById(req.params.id).populate("categoria_id", "nombre");
  if (!producto || (!producto.activo && !esAdmin(req))) {
    throw new HttpError(404, "Producto no encontrado");
  }
  res.json(producto);
};

const crear = async (req, res) => {
  const datos = pick(req.body, CAMPOS);
  await validarCategoria(datos.categoria_id);
  const producto = await MenuItem.create(datos);
  res.status(201).json(producto);
};

const actualizar = async (req, res) => {
  const datos = pick(req.body, CAMPOS);
  await validarCategoria(datos.categoria_id);

  const producto = await MenuItem.findByIdAndUpdate(req.params.id, datos, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!producto) throw new HttpError(404, "Producto no encontrado");
  res.json(producto);
};

// No se borra de verdad: los pedidos antiguos siguen referenciando el producto.
const eliminar = async (req, res) => {
  const producto = await MenuItem.findByIdAndUpdate(
    req.params.id,
    { activo: false },
    { returnDocument: "after" }
  );
  if (!producto) throw new HttpError(404, "Producto no encontrado");
  res.json(producto);
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
