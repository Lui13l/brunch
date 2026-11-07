const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect } = require("./helpers");
const { User, Mesa, Insumo, MenuItem, Comanda, AuditLog, Order, Arqueo, RecetaItem, MovimientoInventario, Category, DeliveryPerson, ChatIntent } = require("../src/models");
const { limpiarE2E } = require("../scripts/limpiarE2E");

let d;

before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);
beforeEach(async () => {
  await limpiar();
  d = await datosBase();
});

const admin = () => bearer(d.tokenAdmin);

// Deja en la base datos reales y datos de prueba e2e mezclados.
const sembrar = async () => {
  // Real
  await api().post("/api/admin/mesas").set(admin()).send({ numero: 5 });
  await api().post("/api/admin/insumos").set(admin()).send({ nombre: "Harina", unidad: "G", stock: 10 });

  // E2E: cuentas, mesa, insumo, plato, receta, comanda enviada, pedido web, caja
  const { body: e2eAdmin } = await api().post("/api/admin/personal").set(admin())
    .send({ nombre: "E2E Admin", email: "admin-r1@e2e.brunch.test", password: "clave123", rol: "MESERO" });
  await api().patch(`/api/admin/personal/${e2eAdmin.id}/rol`).set(admin()).send({ rol: "ADMIN" });
  const { body: login } = await api().post("/api/usuarios/login").send({ email: "admin-r1@e2e.brunch.test", password: "clave123" });
  const e2e = bearer(login.token);

  const { body: mesa } = await api().post("/api/admin/mesas").set(e2e).send({ numero: 901, nombre: "E2E r1" });
  const { body: insumo } = await api().post("/api/admin/insumos").set(e2e)
    .send({ nombre: "[E2E] Harina r1", unidad: "G", stock: 100 });
  const { body: plato } = await api().post("/api/admin/menu").set(e2e)
    .send({ nombre: "[E2E] Pancake r1", precio: 1000, categoriaId: String(d.categoria._id), visibleWeb: false });
  await api().put(`/api/admin/recetas/${plato.id}`).set(e2e).send({ items: [{ insumoId: insumo.id, cantidad: 10 }] });
  const { body: c } = await api().post("/api/comandas").set(e2e).send({ mesaId: mesa.id });
  await api().post(`/api/comandas/${c.id}/items`).set(e2e).send({ menuItemId: plato.id });
  await api().post(`/api/comandas/${c.id}/enviar`).set(e2e);
  await api().post("/api/admin/caja/abrir").set(e2e).send({ baseInicial: 1000 });

  // Panel de admin de la web
  await api().post("/api/categorias").set(e2e).send({ nombre: "[E2E] Categoría r1" });
  await api().post("/api/domiciliarios").set(e2e).send({ nombre: "[E2E] Pedro", apellido: "r1" });
  await api().post("/api/chat/intenciones").set(e2e)
    .send({ ...require("../src/data/intenciones")[0], nombre: "[E2E] intención r1" });

  const { body: cliente } = await api().post("/api/auth/registro")
    .send({ nombre: "E2E Cliente", correo: "cliente-r1@e2e.brunch.test", password: "clave123", direccion: "x" });
  await api().post("/api/pedidos").set(bearer(cliente.token))
    .send({ items: [{ menu_item_id: String(d.cafe._id), cantidad: 1 }] });
};

describe("Limpieza de datos e2e en la base compartida", () => {
  test("en modo simulación solo cuenta, no borra", async () => {
    await sembrar();
    const r = await limpiarE2E({ confirmar: false });
    expect(r.usuarios).toBe(2);
    expect(r.mesas).toBe(1);
    expect(r.comandas).toBe(1);
    expect(r.insumos).toBe(1);
    expect(r.platos).toBe(1);
    expect(r.pedidos).toBe(1);
    expect(r.arqueos).toBe(1);
    expect(r.categorias).toBe(1);
    expect(r.domiciliarios).toBe(1);
    expect(r.intenciones).toBe(1);
    expect(await User.countDocuments()).toBe(4);
  });

  test("con confirmar borra todo lo e2e y nada más", async () => {
    await sembrar();
    await limpiarE2E({ confirmar: true });

    expect(await User.countDocuments({ correo: /@e2e\.brunch\.test$/ })).toBe(0);
    expect(await Mesa.countDocuments()).toBe(1);
    expect(await Insumo.countDocuments()).toBe(1);
    expect(await MenuItem.countDocuments({ nombre: /^\[E2E\]/ })).toBe(0);
    expect(await MenuItem.countDocuments()).toBe(3);
    expect(await Comanda.countDocuments()).toBe(0);
    expect(await Order.countDocuments()).toBe(0);
    expect(await Arqueo.countDocuments()).toBe(0);
    expect(await RecetaItem.countDocuments()).toBe(0);
    expect(await Category.countDocuments({ nombre: /^[E2E]/ })).toBe(0);
    expect(await Category.countDocuments()).toBe(1);
    expect(await DeliveryPerson.countDocuments()).toBe(0);
    expect(await ChatIntent.countDocuments()).toBe(0);
    expect(await MovimientoInventario.countDocuments({ insumo_id: { $ne: (await Insumo.findOne())._id } })).toBe(0);
    // Las acciones del admin real sobre cuentas e2e también se van; las demás quedan.
    expect(await AuditLog.countDocuments({ detalle: /e2e\.brunch\.test|\[E2E\]/ })).toBe(0);
    expect(await AuditLog.countDocuments({ detalle: "Creó la mesa 5" })).toBe(1);

    const otraVez = await limpiarE2E({ confirmar: false });
    expect(Object.values(otraVez).every((n) => n === 0)).toBe(true);
  });
});
