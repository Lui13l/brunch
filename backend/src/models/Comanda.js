const mongoose = require("mongoose");

const ESTADOS_COMANDA = ["ABIERTA", "CERRADA", "ANULADA"];
const ESTADOS_ITEM = ["BORRADOR", "PENDIENTE", "PREPARANDO", "LISTO", "ENTREGADO", "CANCELADO"];
const METODOS_PAGO = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"];
const EN_COCINA = ["PENDIENTE", "PREPARANDO"];

// Plato pedido en la mesa. Nombre y precio se copian al agregarlo para que la
// cuenta no cambie si después se edita la carta.
const itemSchema = new mongoose.Schema({
  menu_item_id: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem", default: null },
  nombre_item: { type: String, required: true },
  precio_unitario: { type: Number, required: true, min: 0 },
  cantidad: { type: Number, required: true, min: 1, max: 99 },
  notas: { type: String, default: null },
  estado: { type: String, enum: ESTADOS_ITEM, default: "BORRADOR" },
  falto_stock: { type: Boolean, default: false },
  inventario_aplicado: { type: Boolean, default: false },
  lote_envio: { type: mongoose.Schema.Types.ObjectId, default: null },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_envio: { type: Date, default: null },
  fecha_listo: { type: Date, default: null },
});

// Cuenta de una mesa. Los platos van embebidos: cada cambio de estado es una
// actualización atómica y condicional sobre un solo documento.
const comandaSchema = new mongoose.Schema(
  {
    mesa_id: { type: mongoose.Schema.Types.ObjectId, ref: "Mesa", required: true },
    mesero_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    estado: { type: String, enum: ESTADOS_COMANDA, default: "ABIERTA" },
    comensales: { type: Number, min: 1, max: 100, default: null },
    notas: { type: String, default: null },
    total: { type: Number, default: null }, // se congela al cerrar
    metodo_pago: { type: String, enum: [...METODOS_PAGO, null], default: null },
    tiene_faltante: { type: Boolean, default: false },
    arqueo_id: { type: mongoose.Schema.Types.ObjectId, ref: "Arqueo", default: null },
    fecha_apertura: { type: Date, default: Date.now },
    fecha_cierre: { type: Date, default: null },
    items: { type: [itemSchema], default: [] },
  },
  { collection: "comandas" }
);

// Una mesa solo puede tener una cuenta abierta a la vez.
comandaSchema.index(
  { mesa_id: 1 },
  { unique: true, partialFilterExpression: { estado: "ABIERTA" }, name: "una_abierta_por_mesa" }
);
comandaSchema.index({ mesa_id: 1, fecha_apertura: -1 });
comandaSchema.index({ estado: 1, fecha_apertura: 1 });
comandaSchema.index({ estado: 1, fecha_cierre: 1 });
comandaSchema.index({ mesero_id: 1, estado: 1 });
comandaSchema.index({ "items.estado": 1 });
comandaSchema.index({ "items._id": 1 });

const Comanda = mongoose.model("Comanda", comandaSchema);
Object.assign(Comanda, { ESTADOS_COMANDA, ESTADOS_ITEM, METODOS_PAGO, EN_COCINA });

module.exports = Comanda;
