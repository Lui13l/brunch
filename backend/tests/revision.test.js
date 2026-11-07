// Regresiones de la revisión final de la migración.
const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect, crearPersonal } = require("./helpers");
const { User, Order, MenuItem } = require("../src/models");
const { aplicarEstado } = require("../src/services/pedidos");

let d;
let adminId;

before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);
beforeEach(async () => {
  await limpiar();
  d = await datosBase();
  adminId = String((await User.findOne({ correo: "admin@test.com" }))._id);
});

const admin = () => bearer(d.tokenAdmin);

describe("Roles: nunca quedarse sin administradores", () => {
  test("la ruta vieja PATCH /usuarios/:id/rol no deja quitarse el rol a uno mismo", async () => {
    const res = await api().patch(`/api/usuarios/${adminId}/rol`).set(admin()).send({ rol_id: "cliente" });
    expect(res.status).toBe(409);
    expect((await User.findById(adminId)).rol_id).toBe("admin");
  });

  test("dos admins degradándose a la vez: al menos uno sigue siendo admin", async () => {
    const b = await crearPersonal("admin", "b@test.com");
    const [r1, r2] = await Promise.all([
      api().patch(`/api/admin/personal/${b.id}/rol`).set(admin()).send({ rol: "MESERO" }),
      api().patch(`/api/admin/personal/${adminId}/rol`).set(bearer(b.token)).send({ rol: "MESERO" }),
    ]);
    expect([r1.status, r2.status].includes(200)).toBe(true);
    expect(await User.countDocuments({ rol_id: "admin", activo: { $ne: false } })).toBeGreaterThan(0);
  });
});

describe("Pedidos: cambios de estado concurrentes", () => {
  test("un cambio sobre un estado viejo no pisa el cambio que ya ocurrió", async () => {
    const { body: pedido } = await api().post("/api/pedidos").set(bearer(d.tokenCliente))
      .send({ items: [{ menu_item_id: String(d.cafe._id), cantidad: 1 }] });
    const viejo = await Order.findById(pedido._id); // leído en "pendiente"
    await api().patch(`/api/pedidos/${pedido._id}/cancelar`).set(bearer(d.tokenCliente));

    const err = await aplicarEstado(viejo, "confirmado").catch((e) => e);
    expect(err.status).toBe(409);
    expect((await Order.findById(pedido._id)).estado).toBe("cancelado");
  });
});

describe("Sesiones del personal", () => {
  test("cambiar la contraseña invalida los tokens anteriores", async () => {
    const mesero = await crearPersonal("mesero");
    await new Promise((r) => setTimeout(r, 1100)); // iat tiene precisión de segundos
    const res = await api().patch(`/api/admin/personal/${mesero.id}/password`).set(admin()).send({ password: "otra123" });
    expect(res.status).toBe(200);
    expect((await api().get("/api/mesas").set(bearer(mesero.token))).status).toBe(401);

    const nuevo = await api().post("/api/usuarios/login").send({ email: "mesero@test.com", password: "otra123" });
    expect((await api().get("/api/mesas").set(bearer(nuevo.body.token))).status).toBe(200);
  });

  test("reactivar una cuenta no revive sus tokens viejos", async () => {
    const mesero = await crearPersonal("mesero");
    await new Promise((r) => setTimeout(r, 1100));
    await api().patch(`/api/admin/personal/${mesero.id}/activo`).set(admin()).send({ activo: false });
    await api().patch(`/api/admin/personal/${mesero.id}/activo`).set(admin()).send({ activo: true });
    expect((await api().get("/api/mesas").set(bearer(mesero.token))).status).toBe(401);
  });
});

describe("Seed", () => {
  test("volver a sembrar no pisa los cambios del admin en la carta", async () => {
    const { sembrarMenu } = require("../src/seed");
    await sembrarMenu();
    await MenuItem.updateOne({ nombre: "Pancakes" }, { precio: 1, descripcion: "editada" });
    await sembrarMenu();
    const p = await MenuItem.findOne({ nombre: "Pancakes" });
    expect(p.precio).toBe(1);
    expect(p.descripcion).toBe("editada");
  });
});
