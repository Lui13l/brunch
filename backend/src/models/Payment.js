const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    pedido_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    usuario_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    monto: {
      type: Number,
      required: true,
      min: 0,
    },

    metodo: {
      type: String,
      enum: ["efectivo", "tarjeta", "transferencia"],
      required: true,
    },

    estado: {
      type: String,
      enum: ["pendiente", "aprobado", "rechazado"],
      default: "pendiente",
    },

    referencia: {
      type: String,
      trim: true,
    },

    // Cuándo se aprobó: desde ese momento cuenta en el arqueo de caja abierto.
    aprobado_en: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "payments",
    timestamps: true,
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
