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

describe("Reservas: el día de hoy es el de Bogotá, no el de UTC", () => {
  test("usa el día y la hora local del restaurante para rechazar horarios pasados", async (t) => {
    // 01:30 UTC del 10 de marzo = 20:30 del 9 de marzo en Bogotá.
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-03-10T01:30:00Z") });
    const hoyBogota = await api().post("/api/reservas").set(bearer(d.tokenCliente))
      .send({ dia: "2026-03-09", hora: "17:00", cupo: 2 });
    expect(hoyBogota.status).toBe(400);

    const mananaBogota = await api().post("/api/reservas").set(bearer(d.tokenCliente))
      .send({ dia: "2026-03-10", hora: "09:00", cupo: 2 });
    expect(mananaBogota.status).toBe(201);

    const ayer = await api().post("/api/reservas").set(bearer(d.tokenCliente))
      .send({ dia: "2026-03-08", hora: "10:00", cupo: 2 });
    expect(ayer.status).toBe(400);
  });

  test("diaCalendarioHoy da la medianoche UTC del día de Bogotá", (t) => {
    const { diaCalendarioHoy } = require("../src/utils/tiempo");
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-03-10T01:30:00Z") });
    expect(diaCalendarioHoy().toISOString()).toBe("2026-03-09T00:00:00.000Z");
  });
});

describe("Escrituras web atómicas (peticiones simultáneas)", () => {
  const { Payment, DeliveryPerson, Reservation } = require("../src/models");
  const pedir = () =>
    api().post("/api/pedidos").set(bearer(d.tokenCliente))
      .send({ items: [{ menu_item_id: String(d.cafe._id), cantidad: 1 }] });

  test("dos pagos a la vez para el mismo pedido: solo uno se crea", async () => {
    const { body: pedido } = await pedir();
    const pagar = () => api().post("/api/pagos").set(bearer(d.tokenCliente)).send({ pedido_id: pedido._id, metodo: "efectivo" });
    const estados = (await Promise.all([pagar(), pagar()])).map((r) => r.status).sort();
    expect(estados).toEqual([201, 409]);
    expect(await Payment.countDocuments({ pedido_id: pedido._id })).toBe(1);
  });

  test("aprobar y rechazar el mismo pago a la vez: solo uno gana", async () => {
    const { body: pedido } = await pedir();
    const { body: pago } = await api().post("/api/pagos").set(bearer(d.tokenCliente)).send({ pedido_id: pedido._id, metodo: "efectivo" });
    const cambiar = (estado) => api().patch(`/api/pagos/${pago._id}/estado`).set(admin()).send({ estado });
    const [a, r] = await Promise.all([cambiar("aprobado"), cambiar("rechazado")]);
    expect([a.status, r.status].filter((s) => s === 200)).toHaveLength(1);
    const ganador = a.status === 200 ? "aprobado" : "rechazado";
    expect((await Payment.findById(pago._id)).estado).toBe(ganador);
  });

  test("un domiciliario no queda asignado a dos pedidos a la vez", async () => {
    const [{ body: p1 }, { body: p2 }] = [await pedir(), await pedir()];
    const dom = await DeliveryPerson.create({ nombre: "Pedro", apellido: "Gómez" });
    const asignar = (p) => api().patch(`/api/pedidos/${p._id}/domiciliario`).set(admin()).send({ domiciliario_id: String(dom._id) });
    const estados = (await Promise.all([asignar(p1), asignar(p2)])).map((r) => r.status).sort();
    expect(estados).toEqual([200, 409]);
    expect(await Order.countDocuments({ domiciliario_id: dom._id })).toBe(1);
  });

  test("confirmar y cancelar la misma reserva a la vez: no se pisan", async () => {
    const manana = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const { body: reserva } = await api().post("/api/reservas").set(bearer(d.tokenCliente)).send({ dia: manana, hora: "10:00", cupo: 2 });
    const cambiar = (estado) => api().patch(`/api/reservas/${reserva._id}/estado`).set(admin()).send({ estado });
    const [c, x] = await Promise.all([cambiar("confirmada"), cambiar("cancelada")]);
    const ok = [c, x].filter((r) => r.status === 200);
    expect(ok).toHaveLength(1);
    expect((await Reservation.findById(reserva._id)).estado_reserva).toBe(ok[0].body.estado_reserva);
  });
});
