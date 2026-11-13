const { describe, test, before, after, beforeEach } = require("node:test");
const {
  conectar, desconectar, limpiar, api, datosBase, bearer, expect, crearPersonal, ID_INEXISTENTE,
} = require("./helpers");
const { Category, MenuItem, AuditLog } = require("../src/models");

let d;
let mesero;

before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);
beforeEach(async () => {
  await limpiar();
  d = await datosBase();
  mesero = await crearPersonal("mesero");
});

const admin = () => bearer(d.tokenAdmin);

describe("Mesas", () => {
  test("el admin crea, edita y borra mesas con el contrato de la app", async () => {
    const creada = await api().post("/api/admin/mesas").set(admin()).send({ numero: 5, nombre: "Ventana", capacidad: null });
    expect(creada.status).toBe(200);
    expect(creada.body.id).toMatch(/^[a-f\d]{24}$/);
    expect(creada.body.numero).toBe(5);
    expect(creada.body.capacidad).toBe(4);
    expect(creada.body.activa).toBe(true);
    expect(creada.body.comandaAbiertaId).toBe(null);

    const dup = await api().post("/api/admin/mesas").set(admin()).send({ numero: 5 });
    expect(dup.status).toBe(409);
    expect(dup.text).toBe("Ya existe la mesa 5");

    const editada = await api().put(`/api/admin/mesas/${creada.body.id}`).set(admin())
      .send({ numero: 6, nombre: null, capacidad: 2, activa: false });
    expect(editada.body.numero).toBe(6);
    expect(editada.body.activa).toBe(false);

    const borrada = await api().delete(`/api/admin/mesas/${creada.body.id}`).set(admin());
    expect(borrada.status).toBe(204);
    const noExiste = await api().delete(`/api/admin/mesas/${ID_INEXISTENTE}`).set(admin());
    expect(noExiste.status).toBe(404);
  });

  test("valida los datos con los mensajes de la API anterior", async () => {
    const res = await api().post("/api/admin/mesas").set(admin()).send({ numero: 0 });
    expect(res.status).toBe(400);
    expect(res.text).toBe("El número de mesa empieza en 1");
  });

  test("el salón solo ve las mesas activas, en orden", async () => {
    await api().post("/api/admin/mesas").set(admin()).send({ numero: 2 });
    await api().post("/api/admin/mesas").set(admin()).send({ numero: 1 });
    await api().post("/api/admin/mesas").set(admin()).send({ numero: 3, activa: false });

    const res = await api().get("/api/mesas").set(bearer(mesero.token));
    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.numero)).toEqual([1, 2]);

    const todas = await api().get("/api/admin/mesas").set(admin());
    expect(todas.body).toHaveLength(3);
  });

  test("los permisos del personal responden en texto", async () => {
    const cliente = await api().get("/api/mesas").set(bearer(d.tokenCliente));
    expect(cliente.status).toBe(403);
    expect(cliente.type).toBe("text/plain");

    const meseroAdmin = await api().get("/api/admin/mesas").set(bearer(mesero.token));
    expect(meseroAdmin.status).toBe(403);

    const sinToken = await api().get("/api/admin/mesas");
    expect(sinToken.status).toBe(401);
    expect(sinToken.type).toBe("text/plain");
  });
});

describe("Carta del admin y del salón", () => {
  const plato = (extra = {}) => ({
    nombre: "Waffle",
    descripcion: "",
    precio: 15000,
    disponible: true,
    visibleWeb: true,
    visibleSalon: true,
    categoriaId: String(d.categoria._id),
    imagenUrl: null,
    ...extra,
  });

  test("crea un plato con el contrato de la app y hereda el tipo de su categoría", async () => {
    const res = await api().post("/api/admin/menu").set(admin()).send(plato());
    expect(res.status).toBe(200);
    expect(res.body.id).toMatch(/^[a-f\d]{24}$/);
    expect(res.body.categoriaId).toBe(String(d.categoria._id));
    expect(res.body.disponible).toBe(true);
    expect(res.body.visibleWeb).toBe(true);
    expect(res.body.descripcion).toBe(null);

    const doc = await MenuItem.findById(res.body.id);
    expect(doc.tipo).toBe("plato");
    expect(doc.activo).toBe(true);
  });

  test("una categoría inexistente es 400", async () => {
    const res = await api().post("/api/admin/menu").set(admin()).send(plato({ categoriaId: ID_INEXISTENTE }));
    expect(res.status).toBe(400);
    expect(res.text).toBe("Categoría no encontrada");
  });

  test("visibleWeb:false lo oculta de la web y no se puede pedir por la web", async () => {
    const creado = await api().post("/api/admin/menu").set(admin()).send(plato({ visibleWeb: false }));
    const web = await api().get("/api/productos");
    expect(web.body.some((p) => p.nombre === "Waffle")).toBe(false);

    const pedido = await api().post("/api/pedidos").set(bearer(d.tokenCliente))
      .send({ items: [{ menu_item_id: creado.body.id, cantidad: 1 }] });
    expect(pedido.status).toBe(400);
  });

  test("editar y borrar; el listado del admin trae también lo inactivo", async () => {
    const creado = await api().post("/api/admin/menu").set(admin()).send(plato());
    const editado = await api().put(`/api/admin/menu/${creado.body.id}`).set(admin())
      .send(plato({ nombre: "Waffle doble", disponible: false }));
    expect(editado.status).toBe(200);
    expect(editado.body.nombre).toBe("Waffle doble");
    expect(editado.body.disponible).toBe(false);

    const todos = await api().get("/api/admin/menu").set(admin());
    expect(todos.body.some((p) => p.nombre === "Viejo")).toBe(true);

    const borrado = await api().delete(`/api/admin/menu/${creado.body.id}`).set(admin());
    expect(borrado.status).toBe(204);
    // Eliminar desactiva: el plato se conserva (oculto) para los reportes y pedidos viejos.
    const doc = await MenuItem.findOne({ nombre: "Waffle doble" });
    expect(doc.activo).toBe(false);
    const listado = await api().get("/api/admin/menu").set(admin());
    expect(listado.body.find((p) => p.nombre === "Waffle doble").disponible).toBe(false);
  });

  test("la carta del salón trae solo lo vendible y omite categorías vacías", async () => {
    await Category.create({ nombre: "Vacía", orden: 9 });
    await api().post("/api/admin/menu").set(admin()).send(plato({ nombre: "Solo web", visibleSalon: false }));

    const res = await api().get("/api/salon/menu").set(bearer(mesero.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const nombres = res.body[0].items.map((i) => i.nombre).sort();
    expect(nombres).toEqual(["Café", "Huevos"]);
    expect(typeof res.body[0].items[0].precio).toBe("number");
  });

  test("la auditoría registra quién hizo el cambio", async () => {
    await api().post("/api/admin/menu").set(admin()).send(plato());
    const res = await api().get("/api/admin/menu/audit").set(admin());
    expect(res.status).toBe(200);
    expect(res.body[0].accion).toBe("CREAR_PRODUCTO");
    expect(res.body[0].detalle).toBe('Creó el producto "Waffle"');
    expect(res.body[0].fecha).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/);

    const log = await AuditLog.findOne({ accion: "CREAR_PRODUCTO" });
    expect(log.usuario_nombre).toBe("Admin");
    expect(log.usuario_rol).toBe("admin");
  });
});
