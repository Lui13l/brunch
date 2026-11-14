const mongoose = require("mongoose");

const reservationSlotSchema = new mongoose.Schema(
  {
    dia: {
      type: Date,
      required: true,
    },

    hora: {
      type: String,
      required: true,
    },

    revision: {
      type: Number,
      default: 0,
    },
  },
  {
    collection: "reservation_slots",
  }
);

reservationSlotSchema.index({ dia: 1, hora: 1 }, { unique: true });

module.exports = mongoose.model("ReservationSlot", reservationSlotSchema);
