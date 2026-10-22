import mongoose from "mongoose";

const responseSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      required: true,
      trim: true,
    },

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

export default ChatIntent;