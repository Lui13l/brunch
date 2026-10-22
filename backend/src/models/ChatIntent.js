const mongoose = require("mongoose");

const responseSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      required: true,
      trim: true,
      default: "texto",
    },

    // Puede incluir variables que se rellenan con datos reales:
    // {nombre}, {menu}, {ultimo_pedido}, {mis_reservas}
    respuesta: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const chatIntentSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    descripcion: {
      type: String,
      trim: true,
    },

    activa: {
      type: Boolean,
      default: true,
    },

    // Palabras o frases que activan la intención. Se comparan sin
    // mayúsculas ni tildes ("menú" coincide con "menu").
    palabras_clave: {
      type: [String],
      default: [],
    },

    respuestas: {
      type: [responseSchema],
      default: [],
    },
  },
  {
    collection: "chat_intents",
    timestamps: true,
  }
);

const ChatIntent = mongoose.model(
  "ChatIntent",
  chatIntentSchema
);

module.exports = ChatIntent;