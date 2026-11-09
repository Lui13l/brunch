const mongoose = require("mongoose");

// Estados a los que puede pasar un pedido web desde cada estado.
const TRANSICIONES = Object.freeze({
  pendiente: ["confirmado", "cancelado"],
  confirmado: ["preparando", "cancelado"],
  preparando: ["en_camino", "cancelado"],
  en_camino: ["entregado"],
  entregado: [],
  cancelado: [],
});
const ACTIVOS = ["pendiente", "confirmado", "preparando", "en_camino"];

const orderItemSchema = new mongoose.Schema(
  {
    menu_item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },

    nombre: {
      type: String,
      required: true,
      trim: true,
    },

    cantidad: {
      type: Number,
      required: true,
      min: 1,
    },

    precio_unitario: {
      type: Number,
      required: true,
      min: 0,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

const orderSchema = new mongoose.Schema(
  {
    usuario_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    direccion_pedido: {
      type: String,
      trim: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return items.length > 0;
        },
        message: "El pedido debe tener al menos un producto",
      },
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    pago_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },

    observaciones: {
      type: String,
      trim: true,
    },

    estado: {
      type: String,
      enum: Object.keys(TRANSICIONES),
      default: "pendiente",
    },

    fecha_inicio: {
      type: Date,
      default: Date.now,
    },

    fecha_programada: {
      type: Date,
    },

    domiciliario_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryPerson",
    },
  },
  {
    collection: "orders",
    timestamps: true,
  }
);

const Order = mongoose.model("Order", orderSchema);
Order.TRANSICIONES = TRANSICIONES;
Order.ACTIVOS = ACTIVOS;

module.exports = Order;