const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Posición en el menú (menor = primero).
    orden: {
      type: Number,
      default: 0,
    },
  },
  {
    collection: "categories",
    timestamps: true,
  }
);

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;