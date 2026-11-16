const { describe, test, before, after, beforeEach } = require("node:test");
const {
  conectar, desconectar, limpiar, api, datosBase, bearer, expect, crearPersonal, ID_INEXISTENTE,
} = require("./helpers");
const { Category, MenuItem, AuditLog, Imagen } = require("../src/models");

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

describe("Plano del salón", () => {
  const crearMesa = async (datos) => (await api().post("/api/admin/mesas").set(admin()).send(datos)).body;
  const plano = (mesas) => api().put("/api/admin/mesas/plano").set(admin()).send({ mesas });

  test("una mesa nueva no está ubicada y trae su forma", async () => {
    const mesa = await crearMesa({ numero: 1, forma: "redonda", capacidad: 6 });
    expect(mesa.forma).toBe("redonda");
    expect(mesa.x).toBe(null);
    expect(mesa.y).toBe(null);
    expect(mesa.rotacion).toBe(0);

    const porDefecto = await crearMesa({ numero: 2 });
    expect(porDefecto.forma).toBe("cuadrada");
  });

  test("guarda las posiciones y el mesero las ve", async () => {
    const a = await crearMesa({ numero: 1 });
    const b = await crearMesa({ numero: 2, forma: "rectangular", capacidad: 6 });

    const res = await plano([
      { id: a.id, x: 0, y: 0 },
      { id: b.id, x: 4, y: 2, rotacion: 90 },
    ]);
    expect(res.status).toBe(200);


    const salon = await api().get("/api/mesas").set(bearer(mesero.token));
    const [uno, dos] = salon.body;
    expect([uno.x, uno.y, uno.rotacion]).toEqual([0, 0, 0]);
    expect([dos.x, dos.y, dos.rotacion]).toEqual([4, 2, 90]);

    // Quitar una mesa del plano: las dos coordenadas en null.
    const fuera = await plano([{ id: a.id, x: null, y: null }]);
    expect(fuera.status).toBe(200);
    expect(fuera.body[0].x).toBe(null);
  });

  test("rechaza mesas encimadas, fuera del plano o desconocidas", async () => {
    const a = await crearMesa({ numero: 1 }); // 2 x 2
    const b = await crearMesa({ numero: 2, forma: "rectangular", capacidad: 10 }); // 4 x 2

    const encima = await plano([
      { id: a.id, x: 3, y: 3 },
      { id: b.id, x: 1, y: 4 },
    ]);
    expect(encima.status).toBe(409);
    expect(encima.text).toBe("Las mesas 1 y 2 quedan encimadas");

    const afuera = await plano([{ id: b.id, x: 9, y: 0 }]);
    expect(afuera.status).toBe(400);
    expect(afuera.text).toBe("La mesa 2 se sale del plano");

    const media = await plano([{ id: a.id, x: 2, y: null }]);
    expect(media.status).toBe(400);

    const desconocida = await plano([{ id: ID_INEXISTENTE, x: 0, y: 0 }]);
    expect(desconocida.status).toBe(404);

    // Nada de lo anterior se guardó.
    const todas = await api().get("/api/admin/mesas").set(admin());
    expect(todas.body.every((m) => m.x === null)).toBe(true);
  });

  test("si al editar la mesa ya no cabe, sale del plano", async () => {
    const a = await crearMesa({ numero: 1 });
    const b = await crearMesa({ numero: 2 });
    await plano([
      { id: a.id, x: 0, y: 0 },
      { id: b.id, x: 2, y: 0 },
    ]);

    // Con 8 puestos la mesa 1 pasa de 2 x 2 a 3 x 3 y pisa a la 2.
    const editada = await api().put(`/api/admin/mesas/${a.id}`).set(admin()).send({ numero: 1, capacidad: 8 });
    expect(editada.status).toBe(200);
    expect(editada.body.x).toBe(null);

    // Un cambio que no altera el tamaño la deja donde estaba.
    const otra = await api().put(`/api/admin/mesas/${b.id}`).set(admin()).send({ numero: 2, nombre: "Ventana" });
    expect([otra.body.x, otra.body.y]).toEqual([2, 0]);
  });

  test("solo el admin arma el plano", async () => {
    const a = await crearMesa({ numero: 1 });

    const res = await api().put("/api/admin/mesas/plano").set(bearer(mesero.token)).send({ mesas: [{ id: a.id, x: 0, y: 0 }] });
    expect(res.status).toBe(403);
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

  describe("Imágenes de platos", () => {
    // Cabecera de PNG y relleno: al servidor le basta para reconocer el formato.
    const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
    const subir = (datos, tipo = "image/png", quien = admin()) =>
      api().post("/api/admin/imagenes").set(quien).set("Content-Type", tipo).send(datos);

    test("el admin sube una imagen y cualquiera la puede ver", async () => {
      const res = await subir(PNG);
      expect(res.status).toBe(201);
      expect(res.body.url).toBe(`/api/imagenes/${res.body.id}`);

      const vista = await api().get(res.body.url);
      expect(vista.status).toBe(200);
      expect(vista.headers["content-type"]).toBe("image/png");
      expect(vista.headers["cross-origin-resource-policy"]).toBe("cross-origin");
      expect(vista.headers["cache-control"]).toMatch(/immutable/);
      expect(Buffer.compare(vista.body, PNG)).toBe(0);

      expect((await api().get(`/api/imagenes/${ID_INEXISTENTE}`)).status).toBe(404);
    });

    test("rechaza lo que no es imagen, lo que pesa demasiado y a quien no es admin", async () => {
      // Dice ser PNG pero el contenido no lo es.
      const disfrazada = await subir(Buffer.from("<script>alert(1)</script>"));
      expect(disfrazada.status).toBe(400);
      expect(disfrazada.text).toBe("Envía una imagen en formato WebP, JPEG o PNG");

      const comoJson = await api().post("/api/admin/imagenes").set(admin()).send({ imagen: "x" });
      expect(comoJson.status).toBe(400);

      const enorme = await subir(Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]));
      expect(enorme.status).toBe(413);

      expect((await subir(PNG, "image/png", bearer(mesero.token))).status).toBe(403);
      expect(await Imagen.countDocuments()).toBe(0);
    });

    test("al cambiar la foto de un plato se borra la anterior si nadie más la usa", async () => {
      const { body: primera } = await subir(PNG);
      const { body: segunda } = await subir(PNG);
      const { body: waffle } = await api().post("/api/admin/menu").set(admin()).send(plato({ imagenUrl: primera.url }));
      const { body: otro } = await api().post("/api/admin/menu").set(admin())
        .send(plato({ nombre: "Otro", imagenUrl: primera.url }));

      // Otro plato sigue usando la primera: no se borra.
      await api().put(`/api/admin/menu/${waffle.id}`).set(admin()).send(plato({ imagenUrl: segunda.url }));
      expect(await Imagen.countDocuments()).toBe(2);

      // Ya nadie la usa. Una ruta de la carta original no es una subida: se deja.
      await api().put(`/api/admin/menu/${otro.id}`).set(admin())
        .send(plato({ nombre: "Otro", imagenUrl: "/menu/pancakes.jpg" }));
      expect(await Imagen.countDocuments()).toBe(1);
      expect((await api().get(primera.url)).status).toBe(404);
      expect((await api().get(segunda.url)).status).toBe(200);
    });
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
