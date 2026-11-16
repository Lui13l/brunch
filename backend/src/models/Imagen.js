const mongoose = require("mongoose");

const TIPOS_IMAGEN = ["image/webp", "image/jpeg", "image/png"];

// Foto de un plato subida desde el computador. Se guarda en la base para no
// depender de un disco ni de otro servicio; por eso llega ya reducida desde el
// navegador y con un tope de tamaño.
const imagenSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: TIPOS_IMAGEN, required: true },
    datos: { type: Buffer, required: true },
    tamano: { type: Number, required: true },
    subida_por: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { collection: "imagenes", timestamps: { createdAt: "fecha", updatedAt: false } }
);

const Imagen = mongoose.model("Imagen", imagenSchema);
Object.assign(Imagen, { TIPOS_IMAGEN });

module.exports = Imagen;
