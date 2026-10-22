const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: ["usuario", "bot", "sistema"],
      required: true,
    },

    mensaje: {
      type: String,
      required: true,
      trim: true,
    },

    fecha_hora: {
      type: Date,
      default: Date.now,
    },

    intencion: {
      type: String,
      trim: true,
    },
  },
  {
    _id: true,
  }
);

const contextSchema = new mongoose.Schema(
  {
    datos: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    _id: false,
  }
);

const chatConversationSchema = new mongoose.Schema(
  {
    usuario_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    fecha_inicio: {
      type: Date,
      default: Date.now,
    },

    fecha_ultima_actividad: {
      type: Date,
      default: Date.now,
    },

    estado: {
      type: String,
      enum: ["activa", "finalizada", "cancelada"],
      default: "activa",
    },

    mensajes: {
      type: [messageSchema],
      default: [],
    },

    contexto: {
      type: contextSchema,
      default: () => ({
        datos: {},
      }),
    },
  },
  {
    collection: "chat_conversations",
    timestamps: true,
  }
);

const ChatConversation = mongoose.model(
  "ChatConversation",
  chatConversationSchema
);

module.exports = ChatConversation;