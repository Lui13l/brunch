// Panel de admin de la web: sus acciones también quedan en la auditoría, y la
// app de comandas puede abrir sesión con el token de la web.
const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect, crearPersonal } = require("./helpers");
const { AuditLog } = require("../src/models");

let d;

before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);
beforeEach(async () => {
  await limpiar();
  d = await datosBase();
});

const admin = () => bearer(d.tokenAdmin);
const ultimo = () => AuditLog.findOne().sort({ fecha: -1, _id: -1 }).lean();

describe("Auditoría de las acciones de admin de la web", () => {
  test("categorías y productos quedan en 'menu' con el admin", async () => {
    const { body: cat } = await api().post("/api/categorias").set(admin()).send({ nombre: "Ensaladas" });
    let log = await ultimo();
    expect(log.servicio).toBe("menu");
    expect(log.accion).toBe("CREAR_CATEGORIA");
    expect(log.detalle).toBe('Creó la categoría "Ensaladas"');
    expect(log.usuario_nombre).toBe("Admin");

    await api().put(`/api/categorias/${cat._id}`).set(admin()).send({ nombre: "Ensaladas frescas" });
    expect((await ultimo()).detalle).toBe('Editó la categoría "Ensaladas frescas"');

    await api().post("/api/productos").set(admin())
      .send({ tipo: "plato", nombre: "César", precio: 1000, categoria_id: cat._id });
    expect((await ultimo()).accion).toBe("CREAR_PRODUCTO");
  });

  test("reservas, chatbot, pagos, domiciliarios y roles quedan en su servicio", async () => {
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const { body: reserva } = await api().post("/api/reservas").set(bearer(d.tokenCliente))
      .send({ dia: manana, hora: "10:00", cupo: 2 });
    await api().patch(`/api/reservas/${reserva._id}/estado`).set(admin()).send({ estado: "confirmada" });
    expect((await ultimo()).servicio).toBe("reservas");

    await api().post("/api/chat/intenciones").set(admin())
      .send({ ...require("../src/data/intenciones")[0], nombre: "intencion-de-prueba" });
    expect((await ultimo()).servicio).toBe("chatbot");

    await api().post("/api/domiciliarios").set(admin()).send({ nombre: "Pedro", apellido: "Gómez" });
    expect((await ultimo()).accion).toBe("CREAR_DOMICILIARIO");

    const mesero = await crearPersonal("mesero");
    await api().patch(`/api/usuarios/${mesero.id}/rol`).set(admin()).send({ rol_id: "cocina" });
    const log = await ultimo();
    expect(log.servicio).toBe("personal");
    expect(log.detalle).toBe("Cambió el rol de mesero@test.com a cocina");
  });

  test("una petición rechazada no se audita", async () => {
    const antes = await AuditLog.countDocuments();
    const r = await api().post("/api/categorias").set(admin()).send({});
    expect(r.status).toBe(400);
    expect(await AuditLog.countDocuments()).toBe(antes);
  });
});

describe("Sesión de la app de comandas con el token de la web", () => {
  test("GET /api/usuarios/yo devuelve el usuario con el contrato del personal", async () => {
    const res = await api().get("/api/usuarios/yo").set(admin());
    expect(res.status).toBe(200);
    expect(res.body.rol).toBe("ADMIN");
    expect(res.body.email).toBe("admin@test.com");
    expect(res.body.id).toMatch(/^[a-f\d]{24}$/);

    const sin = await api().get("/api/usuarios/yo");
    expect(sin.status).toBe(401);
    expect(sin.type).toBe("text/plain");
  });
});
