const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect, crearPersonal } = require("./helpers");
const { User } = require("../src/models");

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
const nuevo = (extra = {}) =>
  api().post("/api/admin/personal").set(admin())
    .send({ nombre: "Lucía", email: "lucia@test.com", password: "clave123", rol: "MESERO", ...extra });

describe("Personal", () => {
  test("lista solo al personal (sin clientes) con el contrato de la app", async () => {
    await crearPersonal("cocina");
    const res = await api().get("/api/admin/personal").set(admin());
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.rol).sort()).toEqual(["ADMIN", "COCINA"]);
    const p = res.body.find((x) => x.rol === "COCINA");
    expect(p.id).toMatch(/^[a-f\d]{24}$/);
    expect(p.email).toBe("cocina@test.com");
    expect(p.activo).toBe(true);
    expect(p.password).toBeUndefined();

    const clientes = await api().get("/api/admin/personal?rol=USUARIO").set(admin());
    expect(clientes.body.map((x) => x.email)).toEqual(["ana@test.com"]);
  });

  test("crea cuentas de mesero o cocina y rechaza duplicados", async () => {
    const res = await nuevo();
    expect(res.status).toBe(200);
    expect(res.body.rol).toBe("MESERO");
    const login = await api().post("/api/usuarios/login").send({ email: "lucia@test.com", password: "clave123" });
    expect(login.body.rol).toBe("MESERO");

    const dup = await nuevo({ email: "LUCIA@test.com" });
    expect(dup.status).toBe(409);
    expect(dup.text).toBe("Ya existe una cuenta con ese correo");

    const adminNuevo = await nuevo({ email: "otro@test.com", rol: "ADMIN" });
    expect(adminNuevo.status).toBe(400);
    const corta = await nuevo({ email: "x@test.com", password: "123" });
    expect(corta.text).toBe("La contraseña debe tener al menos 6 caracteres");
  });

  test("cambia el rol de otro, pero no el propio", async () => {
    const { body: lucia } = await nuevo();
    const res = await api().patch(`/api/admin/personal/${lucia.id}/rol`).set(admin()).send({ rol: "COCINA" });
    expect(res.status).toBe(200);
    expect(res.body.rol).toBe("COCINA");

    const propio = await api().patch(`/api/admin/personal/${adminId}/rol`).set(admin()).send({ rol: "MESERO" });
    expect(propio.status).toBe(409);
    expect(propio.text).toBe("No puedes cambiar tu propio rol");

    const malo = await api().patch(`/api/admin/personal/${lucia.id}/rol`).set(admin()).send({ rol: "JEFE" });
    expect(malo.status).toBe(400);
  });

  test("desactivar corta la sesión; no puedes desactivarte a ti mismo", async () => {
    const mesero = await crearPersonal("mesero");
    const res = await api().patch(`/api/admin/personal/${mesero.id}/activo`).set(admin()).send({ activo: false });
    expect(res.status).toBe(200);
    expect(res.body.activo).toBe(false);
    expect((await api().get("/api/mesas").set(bearer(mesero.token))).status).toBe(401);

    const filtro = await api().get("/api/admin/personal?activo=true").set(admin());
    expect(filtro.body.some((p) => p.id === mesero.id)).toBe(false);

    const propio = await api().patch(`/api/admin/personal/${adminId}/activo`).set(admin()).send({ activo: false });
    expect(propio.status).toBe(409);
    expect(propio.text).toBe("No puedes desactivar tu propia cuenta");

    await api().patch(`/api/admin/personal/${mesero.id}/activo`).set(admin()).send({ activo: true });
    const vuelve = await api().post("/api/usuarios/login").send({ email: "mesero@test.com", password: "clave123" });
    expect(vuelve.status).toBe(200);
  });

  test("el admin pone una contraseña nueva", async () => {
    const { body: lucia } = await nuevo();
    const res = await api().patch(`/api/admin/personal/${lucia.id}/password`).set(admin()).send({ password: "nueva456" });
    expect(res.status).toBe(200);
    const login = await api().post("/api/usuarios/login").send({ email: "lucia@test.com", password: "nueva456" });
    expect(login.status).toBe(200);
  });

  test("un mesero no administra personal", async () => {
    const mesero = await crearPersonal("mesero");
    const res = await api().get("/api/admin/personal").set(bearer(mesero.token));
    expect(res.status).toBe(403);
  });
});

describe("Pedidos web para el admin", () => {
  const pedir = () =>
    api().post("/api/pedidos").set(bearer(d.tokenCliente))
      .send({ items: [{ menu_item_id: String(d.huevos._id), cantidad: 2 }], observaciones: "timbre roto" });

  test("lista los pedidos activos con cliente y transiciones posibles", async () => {
    await pedir();
    const res = await api().get("/api/admin/pedidos?activos=true").set(admin());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const p = res.body[0];
    expect(p.id).toMatch(/^[a-f\d]{24}$/);
    expect(p.estado).toBe("pendiente");
    expect(p.siguientes).toEqual(["confirmado", "cancelado"]);
    expect(p.total).toBe(40000);
    expect(p.items[0]).toEqual({ menuItemId: String(d.huevos._id), nombre: "Huevos", cantidad: 2, precioUnitario: 20000, subtotal: 40000 });
    expect(p.cliente.nombre).toBe("Ana");
    expect(p.direccion).toBe("Calle 1 # 2-3");
    expect(p.observaciones).toBe("timbre roto");
  });

  test("cambia el estado respetando las transiciones", async () => {
    const { body: pedido } = await pedir();
    const ok = await api().patch(`/api/admin/pedidos/${pedido._id}/estado`).set(admin()).send({ estado: "confirmado" });
    expect(ok.status).toBe(200);
    expect(ok.body.estado).toBe("confirmado");
    expect(ok.body.siguientes).toEqual(["preparando", "cancelado"]);

    const malo = await api().patch(`/api/admin/pedidos/${pedido._id}/estado`).set(admin()).send({ estado: "entregado" });
    expect(malo.status).toBe(400);
    expect(malo.text).toBe('No se puede pasar de "confirmado" a "entregado"');

    await api().patch(`/api/admin/pedidos/${pedido._id}/estado`).set(admin()).send({ estado: "cancelado" });
    const activos = await api().get("/api/admin/pedidos?activos=true").set(admin());
    expect(activos.body).toHaveLength(0);
    const cancelados = await api().get("/api/admin/pedidos?estado=cancelado").set(admin());
    expect(cancelados.body).toHaveLength(1);
  });
});

describe("Auditoría", () => {
  test("registra quién hizo cada cosa y filtra por servicio y usuario", async () => {
    await nuevo();
    await api().post("/api/admin/mesas").set(admin()).send({ numero: 4 });

    const personal = await api().get("/api/admin/auditoria?servicio=personal").set(admin());
    expect(personal.status).toBe(200);
    expect(personal.body).toHaveLength(1);
    expect(personal.body[0].accion).toBe("CREAR_CUENTA");
    expect(personal.body[0].usuario).toEqual({ id: adminId, nombre: "Admin", rol: "ADMIN" });

    const todo = await api().get(`/api/admin/auditoria?usuarioId=${adminId}`).set(admin());
    expect(todo.body.map((a) => a.servicio).sort()).toEqual(["comandas", "personal"]);

    const malo = await api().get("/api/admin/auditoria?limite=9999").set(admin());
    expect(malo.status).toBe(400);
  });
});
