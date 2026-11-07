// Borra de la base compartida los datos que dejaron las pruebas e2e.
//   npm run e2e:limpiar                 -> solo cuenta lo que borraría
//   npm run e2e:limpiar -- --confirmar  -> lo borra
const E2E = require("../src/data/e2e");
const {
  User,
  Order,
  Payment,
  Reservation,
  ChatConversation,
  Mesa,
  Comanda,
  Insumo,
  MenuItem,
  RecetaItem,
  MovimientoInventario,
  Arqueo,
  AuditLog,
  Category,
  DeliveryPerson,
  ChatIntent,
} = require("../src/models");

const ids = async (Modelo, filtro) => (await Modelo.find(filtro).select("_id").lean()).map((d) => d._id);

const limpiarE2E = async ({ confirmar = false } = {}) => {
  const usuarios = await ids(User, { correo: E2E.correo });
  const pedidos = await ids(Order, { usuario_id: { $in: usuarios } });
  const mesas = await ids(Mesa, {
    $or: [{ numero: { $gte: E2E.mesaNumeroMinimo } }, { nombre: E2E.mesaNombre }],
  });
  const insumos = await ids(Insumo, { nombre: E2E.prefijo });
  const platos = await ids(MenuItem, { nombre: E2E.prefijo });
  // Una categoría [E2E] que tenga algún plato real no se toca.
  const categoriasE2E = await ids(Category, { nombre: E2E.prefijo });
  const conPlatosReales = await MenuItem.distinct("categoria_id", {
    categoria_id: { $in: categoriasE2E },
    _id: { $nin: platos },
  });
  const categorias = categoriasE2E.filter((id) => !conPlatosReales.some((c) => String(c) === String(id)));

  const filtros = {
    usuarios: [User, { _id: { $in: usuarios } }],
    pedidos: [Order, { _id: { $in: pedidos } }],
    pagos: [Payment, { $or: [{ pedido_id: { $in: pedidos } }, { usuario_id: { $in: usuarios } }] }],
    reservas: [Reservation, { usuario_id: { $in: usuarios } }],
    conversaciones: [ChatConversation, { usuario_id: { $in: usuarios } }],
    comandas: [Comanda, { $or: [{ mesa_id: { $in: mesas } }, { mesero_id: { $in: usuarios } }] }],
    mesas: [Mesa, { _id: { $in: mesas } }],
    recetas: [RecetaItem, { $or: [{ insumo_id: { $in: insumos } }, { menu_item_id: { $in: platos } }] }],
    movimientos: [MovimientoInventario, { insumo_id: { $in: insumos } }],
    insumos: [Insumo, { _id: { $in: insumos } }],
    platos: [MenuItem, { _id: { $in: platos } }],
    categorias: [Category, { _id: { $in: categorias } }],
    domiciliarios: [DeliveryPerson, { nombre: E2E.prefijo }],
    intenciones: [ChatIntent, { nombre: E2E.prefijo }],
    arqueos: [Arqueo, { abierto_por: { $in: usuarios } }],
    auditoria: [AuditLog, { $or: [{ usuario_id: { $in: usuarios } }, { detalle: E2E.detalle }] }],
  };

  const resultado = {};
  for (const [nombre, [Modelo, filtro]] of Object.entries(filtros)) {
    resultado[nombre] = confirmar
      ? (await Modelo.deleteMany(filtro)).deletedCount
      : await Modelo.countDocuments(filtro);
  }
  return resultado;
};

module.exports = { limpiarE2E };

if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");
  const connectDB = require("../src/config/database");
  const confirmar = process.argv.includes("--confirmar");

  (async () => {
    await connectDB();
    const r = await limpiarE2E({ confirmar });
    console.log(confirmar ? "Datos e2e borrados:" : "Datos e2e encontrados (simulación, usa --confirmar para borrar):");
    console.table(r);
    await mongoose.disconnect();
  })().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
}
