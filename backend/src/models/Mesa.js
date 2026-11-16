const mongoose = require("mongoose");

// Mesa del salón. "Ocupada" no se guarda: lo está si tiene una comanda ABIERTA.
const mesaSchema = new mongoose.Schema(
  {
    numero: { type: Number, required: true, unique: true, min: 1, max: 999 },
    nombre: { type: String, trim: true, maxlength: 60, default: null },
    capacidad: { type: Number, min: 1, max: 100, default: 4 },
    // Plano del salón (utils/plano.js): la forma decide el dibujo y, con la
    // capacidad, cuántas celdas ocupa. Sin posición = todavía no está ubicada.
    forma: { type: String, enum: ["cuadrada", "redonda", "rectangular"], default: "cuadrada" },
    pos_x: { type: Number, min: 0, default: null },
    pos_y: { type: Number, min: 0, default: null },
    rotacion: { type: Number, enum: [0, 90], default: 0 },
    activa: { type: Boolean, default: true },
    // Se toca cada vez que una cuenta reclama la mesa (al abrirla o al juntarla
    // con otra). No se muestra: sirve de candado para que dos cuentas no se
    // queden con la misma mesa a la vez (ver services/comandas.js#reclamarMesas).
    reclamada_en: { type: Date, default: null },
  },
  { collection: "mesas", timestamps: true }
);

module.exports = mongoose.model("Mesa", mesaSchema);
