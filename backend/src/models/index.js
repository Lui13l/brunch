const mongoose = require("mongoose");

// Todas las respuestas JSON incluyen "id" (además de "_id") y omiten "__v".
mongoose.set("toJSON", { virtuals: true, versionKey: false });

module.exports = {
  Arqueo: require("./Arqueo"),
  AuditLog: require("./AuditLog"),
  Comanda: require("./Comanda"),
  Insumo: require("./Insumo"),
  Mesa: require("./Mesa"),
  MovimientoInventario: require("./MovimientoInventario"),
  RecetaItem: require("./RecetaItem"),
  Category: require("./Category"),
  ChatConversation: require("./ChatConversation"),
  ChatIntent: require("./ChatIntent"),
  DeliveryPerson: require("./DeliveryPerson"),
  MenuItem: require("./MenuItem"),
  Order: require("./Order"),
  Payment: require("./Payment"),
  Reservation: require("./Reservation"),
  ReservationSlot: require("./ReservationSlot"),
  RevokedToken: require("./RevokedToken"),
  Role: require("./Role"),
  User: require("./User"),
};
