const mongoose = require("mongoose");
const { z } = require("zod");
const { MenuItem, Category, RecetaItem } = require("../models");
const { HttpError } = require("../utils/http");
const { objectId, texto, textoOpcional } = require("../utils/validar");
const { toPlato, toCategoriaSalon, toAuditLog } = require("../utils/serializar");
const { conTransaccion } = require("../utils/transaccion");
const { registrar, listar: listarAuditoria, SERVICIO } = require("../services/auditoria");

const platoSchema = z.object({
  nombre: texto("El nombre"),
  descripcion: textoOpcional("La descripción", 5000),
  precio: z.coerce
    .number({ error: "El precio es obligatorio" })
    .min(0, "El precio no puede ser negativo")
    .max(999_999_999, "El precio es demasiado alto"),
  disponible: z.boolean({ error: "'disponible' debe ser verdadero o falso" }).default(true),
  visibleWeb: z.boolean({ error: "'visibleWeb' debe ser verdadero o falso" }).default(true),
  visibleSalon: z.boolean({ error: "'visibleSalon' debe ser verdadero o falso" }).default(true),
  categoriaId: objectId,
  imagenUrl: textoOpcional("La URL de la imagen"),
  tipo: textoOpcional("El tipo", 40),
});

// Del contrato de la app (camelCase) a los campos del modelo.
const aCampos = (d) => ({
  nombre: d.nombre,
  descripcion: d.descripcion ?? undefined,
  precio: d.precio,
  activo: d.disponible,
  visible_web: d.visibleWeb,
  visible_salon: d.visibleSalon,
  categoria_id: d.categoriaId,
  img_url: d.imagenUrl ?? undefined,
});

const asegurarCategoria = async (categoriaId) => {
  if (!(await Category.exists({ _id: categoriaId }))) throw new HttpError(400, "Categoría no encontrada");
};

// Si no se indica, el plato toma el tipo más común de su categoría (plato, bebida, postre...).
const tipoPorCategoria = async (categoriaId) => {
  const [masComun] = await MenuItem.aggregate([
    { $match: { categoria_id: new mongoose.Types.ObjectId(categoriaId) } },
    { $group: { _id: "$tipo", n: { $sum: 1 } } },
    { $sort: { n: -1, _id: 1 } },
    { $limit: 1 },
  ]);
  return masComun?._id || "plato";
};

const buscar = async (id) => {
  const item = await MenuItem.findById(id);
  if (!item) throw new HttpError(404, "Producto no encontrado");
  return item;
};

const listar = async (req, res) => {
  const items = await MenuItem.find().sort({ categoria_id: 1, orden: 1, nombre: 1 }).lean();
  res.json(items.map(toPlato));
};

const crear = async (req, res) => {
  const datos = req.valid.body;
  await asegurarCategoria(datos.categoriaId);
  const item = await MenuItem.create({
    ...aCampos(datos),
    tipo: datos.tipo || (await tipoPorCategoria(datos.categoriaId)),
  });
  await registrar(req.usuario, "CREAR_PRODUCTO", `Creó el producto "${item.nombre}"`, SERVICIO.MENU);
  res.json(toPlato(item));
};

const editar = async (req, res) => {
  const datos = req.valid.body;
  const item = await buscar(req.valid.params.id);
  await asegurarCategoria(datos.categoriaId);

  // Los campos que la app manda vacíos (null) quedan sin valor.
  Object.assign(item, aCampos(datos));
  if (datos.tipo) item.tipo = datos.tipo;
  await item.save();

  await registrar(req.usuario, "EDITAR_PRODUCTO", `Editó el producto "${item.nombre}"`, SERVICIO.MENU);
  res.json(toPlato(item));
};

// Borrado real (como en la API anterior) junto con su receta. Los pedidos y
// comandas guardan copia del nombre y precio, así que no quedan huérfanos.
const eliminar = async (req, res) => {
  const item = await buscar(req.valid.params.id);
  await conTransaccion(async (session) => {
    await RecetaItem.deleteMany({ menu_item_id: item._id }, { session });
    await MenuItem.deleteOne({ _id: item._id }, { session });
  });
  await registrar(req.usuario, "ELIMINAR_PRODUCTO", `Eliminó el producto "${item.nombre}"`, SERVICIO.MENU);
  res.status(204).end();
};

const auditoria = async (req, res) => {
  res.json((await listarAuditoria({ servicio: SERVICIO.MENU })).map(toAuditLog));
};

// Carta del salón: lo que el mesero puede vender; sin categorías vacías.
const menuSalon = async (req, res) => {
  const [categorias, items] = await Promise.all([
    Category.find().sort({ orden: 1, nombre: 1 }).lean(),
    MenuItem.find({ activo: true, visible_salon: { $ne: false } }).sort({ orden: 1, nombre: 1 }).lean(),
  ]);
  const porCategoria = new Map();
  for (const item of items) {
    const k = String(item.categoria_id);
    if (!porCategoria.has(k)) porCategoria.set(k, []);
    porCategoria.get(k).push(item);
  }
  res.json(
    categorias
      .filter((c) => porCategoria.has(String(c._id)))
      .map((c) => toCategoriaSalon(c, porCategoria.get(String(c._id))))
  );
};

module.exports = { platoSchema, listar, crear, editar, eliminar, auditoria, menuSalon };
