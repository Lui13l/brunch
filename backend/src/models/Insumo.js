const mongoose = require("mongoose");

const UNIDADES = ["G", "ML", "UND"];

// Materia prima. El stock puede quedar negativo a propósito: la cocina nunca se
// frena por el inventario; el negativo avisa que hay que reponer o corregir.
const insumoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, unique: true, trim: true, maxlength: 255 },
    unidad: { type: String, required: true, enum: UNIDADES },
    stock: { type: Number, default: 0 },
    stock_minimo: { type: Number, default: 0, min: 0 },
    activo: { type: Boolean, default: true },
  },
  { collection: "insumos", timestamps: true }
);

const Insumo = mongoose.model("Insumo", insumoSchema);
Insumo.UNIDADES = UNIDADES;

module.exports = Insumo;
