import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      required: true,
      trim: true,
    },

    nombre: {
      type: String,
      required: true,
      trim: true,
    },

    descripcion: {
      type: String,
      trim: true,
    },

    precio: {
      type: Number,
      required: true,
      min: 0,
    },

    categoria_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    img_url: {
      type: String,
      trim: true,
    },

    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: "menu_items",
    timestamps: true,
  }
);

const MenuItem = mongoose.model("MenuItem", menuItemSchema);

export default MenuItem;