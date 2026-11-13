const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
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
      index: true,
    },

    // Una cuenta desactivada no puede iniciar sesión y sus tokens dejan de servir.
    activo: {
      type: Boolean,
      default: true,
    },

    // Tokens emitidos antes de esta fecha ya no valen (contraseña restablecida
    // por un admin o cuenta desactivada).
    credenciales_cambiadas_en: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "users",
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (doc, ret) => {
        delete ret.password;
        return ret;
      },
    },
  }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.compararPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;