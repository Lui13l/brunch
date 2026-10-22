import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },

    nombre: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    collection: "roles",
    timestamps: true,
  }
);

const Role = mongoose.model("Role", roleSchema);

export default Role;