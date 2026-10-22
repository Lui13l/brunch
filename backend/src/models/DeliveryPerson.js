const mongoose = require("mongoose");

const deliveryPersonSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },

    apellido: {
      type: String,
      required: true,
      trim: true,
    },

    estado: {
      type: String,
      enum: ["disponible", "ocupado", "inactivo"],
      default: "disponible",
    },
  },
  {
    collection: "delivery_persons",
    timestamps: true,
  }
);

const DeliveryPerson = mongoose.model(
  "DeliveryPerson",
  deliveryPersonSchema
);

module.exports = DeliveryPerson;