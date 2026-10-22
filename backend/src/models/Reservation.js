const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
  {
    dia: {
      type: Date,
      required: true,
    },

    hora: {
      type: String,
      required: true,
    },

    ocasion: {
      type: String,
      trim: true,
    },

    detalles: {
      type: String,
      trim: true,
    },

    cupo: {
      type: Number,
      required: true,
      min: 1,
    },

    estado_reserva: {
      type: String,
      enum: [
        "pendiente",
        "confirmada",
        "cancelada",
        "finalizada",
      ],
      default: "pendiente",
    },

    usuario_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    collection: "reservations",
    timestamps: true,
  }
);

const Reservation = mongoose.model(
  "Reservation",
  reservationSchema
);

module.exports = Reservation;