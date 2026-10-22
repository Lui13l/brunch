import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },

    direccion: {
      type: String,
      trim: true,
    },

    correo: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    premium: {
      type: Boolean,
      default: false,
    },

    celular: {
      type: String,
      trim: true,
    },

    rol_id: {
      type: String,
      ref: "Role",
      required: true,
    },
  },
  {
    collection: "users",
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;