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
// Estados del pedido en los que sus platos pueden estar en la cocina.
const CON_COCINA = ["confirmado", "preparando"];
const ESTADOS_COCINA = ["PENDIENTE", "PREPARANDO", "LISTO", "CANCELADO"];

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

    // Paso por la cocina. null = todavía no se ha enviado (el pedido no está
    // confirmado). Los mismos estados que los platos de una mesa.
    estado_cocina: {
      type: String,
      enum: [...ESTADOS_COCINA, null],
      default: null,
    },

    falto_stock: { type: Boolean, default: false },
    inventario_aplicado: { type: Boolean, default: false },
    fecha_envio: { type: Date, default: null },
    fecha_listo: { type: Date, default: null },
  }
  // Cada plato tiene _id: la cocina lo marca por ese id. Los pedidos antiguos
  // (sin _id en sus platos) lo reciben cuando entran a cocina.
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

    // Cuándo entraron sus platos a cocina (al confirmarse). Sirve de candado:
    // un pedido solo se envía una vez.
    enviado_cocina_en: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "orders",
    timestamps: true,
  }
);

orderSchema.index({ estado: 1, "items.estado_cocina": 1 });
orderSchema.index({ "items._id": 1 });

const Order = mongoose.model("Order", orderSchema);
Order.TRANSICIONES = TRANSICIONES;
Order.ACTIVOS = ACTIVOS;
Order.CON_COCINA = CON_COCINA;
Order.ESTADOS_COCINA = ESTADOS_COCINA;

module.exports = Order;