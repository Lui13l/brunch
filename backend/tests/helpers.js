const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.JWT_SECRET = "secreto-de-pruebas";
process.env.ZONA_HORARIA = "America/Bogota";
// Límites altos para que no interfieran; seguridad.test.js los baja para probarlos.
process.env.RATE_LIMIT_AUTH_MAX ??= "1000";
process.env.RATE_LIMIT_CHAT_MAX ??= "1000";

const app = require("../src/app");
const { Role, User, Category, MenuItem } = require("../src/models");

let mongo;

const conectar = async () => {
  // Replica set de un nodo: las transacciones (comandas, inventario) lo necesitan, igual que Atlas.
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    // Con varios archivos de prueba en paralelo el arranque en frío puede tardar.
    instanceOpts: [{ launchTimeout: 60_000 }],
  });
  await mongoose.connect(mongo.getUri());
  // Crea colecciones e índices (únicos y parciales) antes de cualquier prueba.
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));
};

const desconectar = async () => {
  await mongoose.disconnect();
  await mongo.stop();
};

const limpiar = async () => {
  const colecciones = await mongoose.connection.db.collections();
  await Promise.all(colecciones.map((c) => c.deleteMany({})));
};

const api = () => request(app);

const login = async (correo, password) => {
  const res = await api().post("/api/auth/login").send({ correo, password });
  return res.body.token;
};

// Crea roles, un admin, un cliente y un par de productos. Devuelve tokens e ids.
const datosBase = async () => {
  await Role.create([
    { _id: "admin", nombre: "Administrador" },
    { _id: "cliente", nombre: "Cliente" },
    { _id: "mesero", nombre: "Mesero" },
    { _id: "cocina", nombre: "Cocina" },
  ]);
  await User.create({ nombre: "Admin", correo: "admin@test.com", password: "admin123", rol_id: "admin" });

  const registro = await api().post("/api/auth/registro").send({
    nombre: "Ana",
    correo: "ana@test.com",
    password: "secreta1",
    direccion: "Calle 1 # 2-3",
  });

  const categoria = await Category.create({ nombre: "Platos" });
  const [huevos, cafe, inactivo] = await MenuItem.create([
    { tipo: "plato", nombre: "Huevos", precio: 20000, categoria_id: categoria._id },
    { tipo: "bebida", nombre: "Café", precio: 5000, categoria_id: categoria._id },
    { tipo: "plato", nombre: "Viejo", precio: 1000, categoria_id: categoria._id, activo: false },
  ]);

  return {
    tokenAdmin: await login("admin@test.com", "admin123"),
    tokenCliente: registro.body.token,
    cliente: registro.body.usuario,
    categoria,
    huevos,
    cafe,
    inactivo,
  };
};

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

// Crea una cuenta del personal (mesero/cocina/admin) y devuelve { usuario, token }
// usando el login de la app de comandas.
const crearPersonal = async (rol_id, correo = `${rol_id}@test.com`, password = "clave123") => {
  const usuario = await User.create({ nombre: `${rol_id} prueba`, correo, password, rol_id });
  const res = await api().post("/api/usuarios/login").send({ email: correo, password });
  return { usuario, token: res.body.token, id: String(usuario._id) };
};

const ID_INEXISTENTE = "507f1f77bcf86cd799439011";

// expect() mínimo sobre node:assert, con la misma sintaxis que Jest.
const expect = (valor) => ({
  toBe: (esperado) => assert.equal(valor, esperado),
  toEqual: (esperado) => assert.deepEqual(valor, esperado),
  toBeDefined: () => assert.notEqual(valor, undefined),
  toBeUndefined: () => assert.equal(valor, undefined),
  toHaveLength: (n) => assert.equal(valor.length, n),
  toMatch: (re) => assert.match(valor, re),
  toBeGreaterThan: (n) => assert.ok(valor > n, `${valor} no es mayor que ${n}`),
});

module.exports = {
  conectar,
  desconectar,
  limpiar,
  api,
  login,
  datosBase,
  bearer,
  expect,
  crearPersonal,
  ID_INEXISTENTE,
};
