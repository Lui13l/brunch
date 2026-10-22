const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect } = require("./helpers");

let d;

// La primera ejecución descarga el binario de MongoDB (~700 MB), por eso el timeout amplio.
before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);
beforeEach(async () => {
  await limpiar();
  d = await datosBase();
});

const manana = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe("General", () => {
  test("ruta inexistente devuelve 404", async () => {
    const res = await api().get("/api/no-existe");
    expect(res.status).toBe(404);
  });

  test("id con formato inválido devuelve 400", async () => {
    const res = await api().get("/api/productos/abc");
    expect(res.status).toBe(400);
  });
});

describe("Auth", () => {
  test("registro devuelve token, rol cliente y nunca la contraseña", async () => {
    const res = await api().post("/api/auth/registro").send({
      nombre: "Luis",
      correo: "LUIS@test.com",
      password: "123456",
      rol_id: "admin",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario.rol_id).toBe("cliente");
    expect(res.body.usuario.correo).toBe("luis@test.com");
    expect(res.body.usuario.password).toBeUndefined();
  });

  test("correo duplicado devuelve 409", async () => {
    const res = await api()
      .post("/api/auth/registro")
      .send({ nombre: "Otra", correo: "ana@test.com", password: "123456" });
    expect(res.status).toBe(409);
  });

  test("datos incompletos devuelven 400", async () => {
    const res = await api().post("/api/auth/registro").send({ nombre: "X" });
    expect(res.status).toBe(400);
  });

  test("login con contraseña incorrecta devuelve 401", async () => {
    const res = await api().post("/api/auth/login").send({ correo: "ana@test.com", password: "mala" });
    expect(res.status).toBe(401);
  });

  test("perfil requiere token válido", async () => {
    expect((await api().get("/api/auth/perfil")).status).toBe(401);
    expect((await api().get("/api/auth/perfil").set(bearer("basura"))).status).toBe(401);

    const res = await api().get("/api/auth/perfil").set(bearer(d.tokenCliente));
    expect(res.status).toBe(200);
    expect(res.body.correo).toBe("ana@test.com");
  });

  test("actualizar la contraseña del perfil permite iniciar sesión con la nueva", async () => {
    await api().put("/api/usuarios/perfil").set(bearer(d.tokenCliente)).send({ password: "nueva123" });
    const res = await api().post("/api/auth/login").send({ correo: "ana@test.com", password: "nueva123" });
    expect(res.status).toBe(200);
  });
});

describe("Productos y categorías", () => {
  test("el listado público solo trae activos e incluye id y categoría", async () => {
    const res = await api().get("/api/productos");
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.nombre).sort()).toEqual(["Café", "Huevos"]);
    expect(res.body[0].id).toBeDefined();
    expect(res.body[0].categoria_id.nombre).toBe("Platos");
  });

  test("un admin puede ver los inactivos", async () => {
    const res = await api().get("/api/productos?incluir_inactivos=true").set(bearer(d.tokenAdmin));
    expect(res.body).toHaveLength(3);
  });

  test("un cliente no puede crear productos", async () => {
    const res = await api()
      .post("/api/productos")
      .set(bearer(d.tokenCliente))
      .send({ tipo: "plato", nombre: "X", precio: 1, categoria_id: d.categoria.id });
    expect(res.status).toBe(403);
  });

  test("admin crea producto; categoría inexistente devuelve 400", async () => {
    const ok = await api()
      .post("/api/productos")
      .set(bearer(d.tokenAdmin))
      .send({ tipo: "plato", nombre: "Arepa", precio: 8000, categoria_id: d.categoria.id });
    expect(ok.status).toBe(201);

    const mal = await api()
      .post("/api/productos")
      .set(bearer(d.tokenAdmin))
      .send({ tipo: "plato", nombre: "Y", precio: 1, categoria_id: "507f1f77bcf86cd799439011" });
    expect(mal.status).toBe(400);
  });

  test("eliminar un producto lo desactiva", async () => {
    const res = await api().delete(`/api/productos/${d.cafe.id}`).set(bearer(d.tokenAdmin));
    expect(res.body.activo).toBe(false);
    expect((await api().get(`/api/productos/${d.cafe.id}`)).status).toBe(404);
  });

  test("las categorías se listan por su orden y los productos lo incluyen", async () => {
    await api().post("/api/categorias").set(bearer(d.tokenAdmin)).send({ nombre: "Bebidas", orden: 2 });
    await api().post("/api/categorias").set(bearer(d.tokenAdmin)).send({ nombre: "Abrebocas", orden: 5 });
    await api().put(`/api/categorias/${d.categoria.id}`).set(bearer(d.tokenAdmin)).send({ orden: 1 });

    const categorias = await api().get("/api/categorias");
    expect(categorias.body.map((c) => c.nombre)).toEqual(["Platos", "Bebidas", "Abrebocas"]);

    const productos = await api().get("/api/productos");
    expect(productos.body[0].categoria_id.orden).toBe(1);
  });

  test("no se puede eliminar una categoría con productos", async () => {
    const res = await api().delete(`/api/categorias/${d.categoria.id}`).set(bearer(d.tokenAdmin));
    expect(res.status).toBe(409);
  });
});

describe("Pedidos", () => {
  const crearPedido = (token, items) =>
    api().post("/api/pedidos").set(bearer(token)).send({ items });

  test("el total se calcula con los precios de la base de datos", async () => {
    const res = await crearPedido(d.tokenCliente, [
      { menu_item_id: d.huevos.id, cantidad: 2, precio_unitario: 1 },
      { menu_item_id: d.cafe.id, cantidad: 3 },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(2 * 20000 + 3 * 5000);
    expect(res.body.items[0].precio_unitario).toBe(20000);
    expect(res.body.estado).toBe("pendiente");
    expect(res.body.direccion_pedido).toBe("Calle 1 # 2-3");
  });

  test("rechaza productos inactivos, cantidades inválidas y pedidos vacíos", async () => {
    expect((await crearPedido(d.tokenCliente, [{ menu_item_id: d.inactivo.id, cantidad: 1 }])).status).toBe(400);
    expect((await crearPedido(d.tokenCliente, [{ menu_item_id: d.cafe.id, cantidad: 0 }])).status).toBe(400);
    expect((await crearPedido(d.tokenCliente, [])).status).toBe(400);
  });

  test("un cliente no puede ver pedidos de otro ni listar todos", async () => {
    const pedido = (await crearPedido(d.tokenAdmin, [{ menu_item_id: d.cafe.id, cantidad: 1 }])).body;

    expect((await api().get(`/api/pedidos/${pedido.id}`).set(bearer(d.tokenCliente))).status).toBe(403);
    expect((await api().get("/api/pedidos").set(bearer(d.tokenCliente))).status).toBe(403);
  });

  test("mis-pedidos solo trae los del usuario", async () => {
    await crearPedido(d.tokenCliente, [{ menu_item_id: d.cafe.id, cantidad: 1 }]);
    await crearPedido(d.tokenAdmin, [{ menu_item_id: d.cafe.id, cantidad: 1 }]);

    const res = await api().get("/api/pedidos/mis-pedidos").set(bearer(d.tokenCliente));
    expect(res.body).toHaveLength(1);
  });

  test("flujo de estados con domiciliario", async () => {
    const pedido = (await crearPedido(d.tokenCliente, [{ menu_item_id: d.cafe.id, cantidad: 1 }])).body;
    const estado = (e) =>
      api().patch(`/api/pedidos/${pedido.id}/estado`).set(bearer(d.tokenAdmin)).send({ estado: e });

    expect((await estado("entregado")).status).toBe(400);
    expect((await estado("confirmado")).body.estado).toBe("confirmado");

    const dom = (
      await api().post("/api/domiciliarios").set(bearer(d.tokenAdmin)).send({ nombre: "Pedro", apellido: "Gómez" })
    ).body;
    const asignado = await api()
      .patch(`/api/pedidos/${pedido.id}/domiciliario`)
      .set(bearer(d.tokenAdmin))
      .send({ domiciliario_id: dom.id });
    expect(asignado.status).toBe(200);

    const ocupado = await api().get(`/api/domiciliarios/${dom.id}`).set(bearer(d.tokenAdmin));
    expect(ocupado.body.estado).toBe("ocupado");

    await estado("preparando");
    await estado("en_camino");
    expect((await estado("entregado")).body.estado).toBe("entregado");

    const libre = await api().get(`/api/domiciliarios/${dom.id}`).set(bearer(d.tokenAdmin));
    expect(libre.body.estado).toBe("disponible");
  });

  test("el cliente puede cancelar su pedido pendiente", async () => {
    const pedido = (await crearPedido(d.tokenCliente, [{ menu_item_id: d.cafe.id, cantidad: 1 }])).body;
    const res = await api().patch(`/api/pedidos/${pedido.id}/cancelar`).set(bearer(d.tokenCliente));
    expect(res.body.estado).toBe("cancelado");
  });
});

describe("Pagos", () => {
  test("el monto es el total del pedido y aprobarlo confirma el pedido", async () => {
    const pedido = (
      await api()
        .post("/api/pedidos")
        .set(bearer(d.tokenCliente))
        .send({ items: [{ menu_item_id: d.huevos.id, cantidad: 1 }] })
    ).body;

    const pago = await api()
      .post("/api/pagos")
      .set(bearer(d.tokenCliente))
      .send({ pedido_id: pedido.id, metodo: "tarjeta", monto: 1 });
    expect(pago.status).toBe(201);
    expect(pago.body.monto).toBe(20000);

    const duplicado = await api()
      .post("/api/pagos")
      .set(bearer(d.tokenCliente))
      .send({ pedido_id: pedido.id, metodo: "efectivo" });
    expect(duplicado.status).toBe(409);

    expect(
      (await api().patch(`/api/pagos/${pago.body.id}/estado`).set(bearer(d.tokenCliente)).send({ estado: "aprobado" }))
        .status
    ).toBe(403);

    await api().patch(`/api/pagos/${pago.body.id}/estado`).set(bearer(d.tokenAdmin)).send({ estado: "aprobado" });
    const actualizado = await api().get(`/api/pedidos/${pedido.id}`).set(bearer(d.tokenCliente));
    expect(actualizado.body.estado).toBe("confirmado");
    expect(actualizado.body.pago_id.estado).toBe("aprobado");
  });

  test("método de pago inválido devuelve 400", async () => {
    const pedido = (
      await api()
        .post("/api/pedidos")
        .set(bearer(d.tokenCliente))
        .send({ items: [{ menu_item_id: d.cafe.id, cantidad: 1 }] })
    ).body;
    const res = await api()
      .post("/api/pagos")
      .set(bearer(d.tokenCliente))
      .send({ pedido_id: pedido.id, metodo: "bitcoin" });
    expect(res.status).toBe(400);
  });
});

describe("Reservas", () => {
  const reservar = (datos) => api().post("/api/reservas").set(bearer(d.tokenCliente)).send(datos);

  test("valida fecha pasada, formato de hora y cupo", async () => {
    expect((await reservar({ dia: "2020-01-01", hora: "10:00", cupo: 2 })).status).toBe(400);
    expect((await reservar({ dia: manana(), hora: "25:00", cupo: 2 })).status).toBe(400);
    expect((await reservar({ dia: manana(), hora: "10:00", cupo: 0 })).status).toBe(400);
  });

  test("crear, filtrar por fecha (admin) y cancelar", async () => {
    const reserva = await reservar({ dia: manana(), hora: "10:30", cupo: 4, ocasion: "Cumpleaños" });
    expect(reserva.status).toBe(201);
    expect(reserva.body.estado_reserva).toBe("pendiente");

    const delDia = await api().get(`/api/reservas?fecha=${manana()}`).set(bearer(d.tokenAdmin));
    expect(delDia.body).toHaveLength(1);

    const cancelada = await api().patch(`/api/reservas/${reserva.body.id}/cancelar`).set(bearer(d.tokenCliente));
    expect(cancelada.body.estado_reserva).toBe("cancelada");

    const otraVez = await api().patch(`/api/reservas/${reserva.body.id}/cancelar`).set(bearer(d.tokenCliente));
    expect(otraVez.status).toBe(400);
  });
});

describe("Usuarios", () => {
  test("solo el admin lista usuarios y cambia roles", async () => {
    expect((await api().get("/api/usuarios").set(bearer(d.tokenCliente))).status).toBe(403);

    const lista = await api().get("/api/usuarios").set(bearer(d.tokenAdmin));
    expect(lista.body).toHaveLength(2);
    expect(lista.body.every((u) => u.password === undefined)).toBe(true);

    const rol = await api()
      .patch(`/api/usuarios/${d.cliente.id}/rol`)
      .set(bearer(d.tokenAdmin))
      .send({ rol_id: "admin" });
    expect(rol.body.rol_id).toBe("admin");

    const invalido = await api()
      .patch(`/api/usuarios/${d.cliente.id}/rol`)
      .set(bearer(d.tokenAdmin))
      .send({ rol_id: "superusuario" });
    expect(invalido.status).toBe(400);
  });
});
