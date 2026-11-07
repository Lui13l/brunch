const { z } = require("zod");
const { MenuItem, Insumo, RecetaItem } = require("../models");
const { HttpError } = require("../utils/http");
const { objectId } = require("../utils/validar");
const { toPlato, toRecetaItem } = require("../utils/serializar");
const { conTransaccion } = require("../utils/transaccion");
const { registrar, SERVICIO } = require("../services/auditoria");
const { cantidad } = require("./insumoController");

const recetaSchema = z.object({
  items: z
    .array(z.object({ insumoId: objectId, cantidad: cantidad("La cantidad", { minimo: 0.001 }) }), {
      error: "La receta debe ser una lista",
    })
    .max(50, "Demasiados insumos en una sola receta"),
});

const buscarPlato = async (id) => {
  const plato = await MenuItem.findById(id).lean();
  if (!plato) throw new HttpError(404, "Producto no encontrado");
  return plato;
};

const recetaDe = (menuItemId, session) =>
  RecetaItem.find({ menu_item_id: menuItemId })
    .session(session || null)
    .populate("insumo_id", "nombre unidad")
    .sort({ _id: 1 })
    .lean();

const obtener = async (req, res) => {
  const plato = await buscarPlato(req.valid.params.id);
  const receta = await recetaDe(plato._id);
  res.json({ plato: toPlato(plato), receta: receta.map(toRecetaItem) });
};

// Reemplaza la receta completa: la pantalla del admin envía siempre la receta entera.
const guardar = async (req, res) => {
  const plato = await buscarPlato(req.valid.params.id);
  const { items } = req.valid.body;

  const ids = items.map((i) => i.insumoId);
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "La receta tiene el mismo insumo repetido");
  if ((await Insumo.countDocuments({ _id: { $in: ids } })) !== ids.length) {
    throw new HttpError(400, "Algún insumo de la receta no existe");
  }

  const receta = await conTransaccion(async (session) => {
    await RecetaItem.deleteMany({ menu_item_id: plato._id }, { session });
    if (items.length > 0) {
      await RecetaItem.insertMany(
        items.map((i) => ({ menu_item_id: plato._id, insumo_id: i.insumoId, cantidad: i.cantidad })),
        { session }
      );
    }
    return recetaDe(plato._id, session);
  });

  await registrar(
    req.usuario,
    "GUARDAR_RECETA",
    `Definió la receta de "${plato.nombre}" con ${items.length} insumo(s)`,
    SERVICIO.INVENTARIO
  );
  res.json(receta.map(toRecetaItem));
};

// Platos sin receta: se venden sin descontar inventario.
const faltantes = async (req, res) => {
  const conReceta = await RecetaItem.distinct("menu_item_id");
  const platos = await MenuItem.find({ _id: { $nin: conReceta } }).sort({ nombre: 1 }).lean();
  res.json(platos.map(toPlato));
};

module.exports = { recetaSchema, obtener, guardar, faltantes };
