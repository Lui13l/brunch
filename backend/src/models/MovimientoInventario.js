const mongoose = require("mongoose");

const TIPOS = ["CONSUMO", "DEVOLUCION", "AJUSTE", "COMPRA"];

// Libro del inventario: cada cambio de stock deja una línea. "cantidad" lleva
// signo (negativa al consumir) y "stock_resultante" el saldo tras aplicarla.
const movimientoSchema = new mongoose.Schema(
  {
    insumo_id: { type: mongoose.Schema.Types.ObjectId, ref: "Insumo", required: true },
    tipo: { type: String, required: true, enum: TIPOS },
    cantidad: {
      type: Number,
      required: true,
      validate: { validator: (v) => v !== 0, message: "La cantidad no puede ser cero" },
    },
    stock_resultante: { type: Number, required: true },
    motivo: { type: String, default: null },
    comanda_id: { type: mongoose.Schema.Types.ObjectId, ref: "Comanda", default: null },
    comanda_item_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    fecha: { type: Date, default: Date.now },
  },
  { collection: "movimientos_inventario" }
);

movimientoSchema.index({ insumo_id: 1, fecha: -1 });
movimientoSchema.index({ comanda_item_id: 1 });
movimientoSchema.index({ fecha: 1 });

const MovimientoInventario = mongoose.model("MovimientoInventario", movimientoSchema);
MovimientoInventario.TIPOS = TIPOS;

module.exports = MovimientoInventario;
