const mongoose = require("mongoose");

// Mesa del salón. "Ocupada" no se guarda: lo está si tiene una comanda ABIERTA.
const mesaSchema = new mongoose.Schema(
  {
    numero: { type: Number, required: true, unique: true, min: 1, max: 999 },
    nombre: { type: String, trim: true, maxlength: 60, default: null },
    capacidad: { type: Number, min: 1, max: 100, default: 4 },
    activa: { type: Boolean, default: true },
  },
  { collection: "mesas", timestamps: true }
);

module.exports = mongoose.model("Mesa", mesaSchema);
