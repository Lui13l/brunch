const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = "secreto-de-pruebas";
// Límites altos para que no interfieran; seguridad.test.js los baja para probarlos.
process.env.RATE_LIMIT_AUTH_MAX ??= "1000";
process.env.RATE_LIMIT_CHAT_MAX ??= "1000";

const app = require("../src/app");
const { Role, User, Category, MenuItem } = require("../src/models");

let mongo;

const conectar = async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
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

// expect() mínimo sobre node:assert, con la misma sintaxis que Jest.
const expect = (valor) => ({
  toBe: (esperado) => assert.equal(valor, esperado),
  toEqual: (esperado) => assert.deepEqual(valor, esperado),
  toBeDefined: () => assert.notEqual(valor, undefined),
  toBeUndefined: () => assert.equal(valor, undefined),
  toHaveLength: (n) => assert.equal(valor.length, n),
});

module.exports = { conectar, desconectar, limpiar, api, login, datosBase, bearer, expect };
