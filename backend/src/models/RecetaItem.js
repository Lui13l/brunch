const mongoose = require("mongoose");

// Cuánto de un insumo lleva una unidad de un plato (en la unidad del insumo).
const recetaItemSchema = new mongoose.Schema(
  {
    menu_item_id: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem", required: true },
    insumo_id: { type: mongoose.Schema.Types.ObjectId, ref: "Insumo", required: true },
    cantidad: {
      type: Number,
      required: true,
      validate: { validator: (v) => v > 0, message: "La cantidad debe ser mayor que 0" },
    },
  },
  { collection: "receta_items" }
);

recetaItemSchema.index({ menu_item_id: 1, insumo_id: 1 }, { unique: true });
recetaItemSchema.index({ insumo_id: 1 });

module.exports = mongoose.model("RecetaItem", recetaItemSchema);
