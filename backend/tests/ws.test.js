const { describe, test, before, after, beforeEach } = require("node:test");
const http = require("node:http");
const WebSocket = require("ws");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect, crearPersonal } = require("./helpers");
const app = require("../src/app");
const { adjuntarWebSocket } = require("../src/ws");

let d;
let server;
let cerrarWs;
let url;

before(async () => {
  await conectar();
  server = http.createServer(app);
  cerrarWs = adjuntarWebSocket(server);
  await new Promise((r) => server.listen(0, r));
  url = `ws://127.0.0.1:${server.address().port}/ws`;
}, { timeout: 10 * 60 * 1000 });

after(async () => {
  cerrarWs();
  await new Promise((r) => server.close(r));
  await desconectar();
});

beforeEach(async () => {
  await limpiar();
  d = await datosBase();
  delete process.env.WS_ORIGINS;
});

// Cliente de prueba: guarda los mensajes y permite esperar uno concreto.
const cliente = (headers = {}) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    const recibidos = [];
    const esperas = [];
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      const i = esperas.findIndex((e) => e.pred(msg));
      if (i >= 0) esperas.splice(i, 1)[0].resolve(msg);
      else recibidos.push(msg);
    });
    ws.esperar = (pred, ms = 3000) => {
      const i = recibidos.findIndex(pred);
      if (i >= 0) return Promise.resolve(recibidos.splice(i, 1)[0]);
      return new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error("No llegó el mensaje esperado")), ms);
        esperas.push({ pred, resolve: (m) => { clearTimeout(t); res(m); } });
      });
    };
    // Código de cierre, o "sin cierre" si no se cierra en 3 s (para que no cuelgue).
    ws.cierre = new Promise((r) => {
      const t = setTimeout(() => r("sin cierre"), 3000);
      ws.on("close", (code) => { clearTimeout(t); r(code); });
    });
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
    ws.on("unexpected-response", (req, res) => reject(Object.assign(new Error("rechazado"), { status: res.statusCode })));
  });

const autenticado = async (token) => {
  const ws = await cliente();
  ws.send(JSON.stringify({ type: "auth", token }));
  await ws.esperar((m) => m.type === "ready");
  return ws;
};

const suscribir = async (ws, topics) => {
  ws.send(JSON.stringify({ type: "subscribe", topics }));
  return ws.esperar((m) => m.type === "subscribed");
};

describe("WebSocket", () => {
  test("autentica, suscribe según el rol y responde ping", async () => {
    const mesero = await crearPersonal("mesero");
    const ws = await autenticado(mesero.token);

    ws.send(JSON.stringify({ type: "subscribe", topics: ["/topic/salon", "/topic/cocina", `/topic/mesero/${mesero.id}/comandas`] }));
    const error = await ws.esperar((m) => m.type === "error");
    expect(error.topic).toBe("/topic/cocina");
    const ok = await ws.esperar((m) => m.type === "subscribed");
    expect(ok.topics).toEqual(["/topic/salon", `/topic/mesero/${mesero.id}/comandas`]);

    ws.send(JSON.stringify({ type: "ping" }));
    await ws.esperar((m) => m.type === "pong");
    ws.close();
  });

  test("un token inválido cierra con 4401", async () => {
    const ws = await cliente();
    ws.send(JSON.stringify({ type: "auth", token: "basura" }));
    expect(await ws.cierre).toBe(4401);
  });

  test("al cerrar sesión se corta el socket de ese token y ya no autentica", async () => {
    const mesero = await crearPersonal("mesero");
    const ws = await autenticado(mesero.token);
    await api().post("/api/auth/logout").set(bearer(mesero.token));
    expect(await ws.cierre).toBe(4401);

    const otro = await cliente();
    otro.send(JSON.stringify({ type: "auth", token: mesero.token }));
    expect(await otro.cierre).toBe(4401);
  });

  test("rechaza orígenes no permitidos cuando hay lista", async () => {
    process.env.WS_ORIGINS = "http://localhost:5174";
    const rechazo = await cliente({ Origin: "http://malicioso.test" }).catch((e) => e);
    expect(rechazo.status).toBe(403);
    const ok = await cliente({ Origin: "http://localhost:5174" });
    ok.close();
  });

  test("cambiar el rol cierra con 4403 y desactivar con 4401", async () => {
    const a = await crearPersonal("mesero", "a@test.com");
    const b = await crearPersonal("mesero", "b@test.com");
    const wsA = await autenticado(a.token);
    const wsB = await autenticado(b.token);

    await api().patch(`/api/admin/personal/${a.id}/rol`).set(bearer(d.tokenAdmin)).send({ rol: "COCINA" });
    expect(await wsA.cierre).toBe(4403);
    await api().patch(`/api/admin/personal/${b.id}/activo`).set(bearer(d.tokenAdmin)).send({ activo: false });
    expect(await wsB.cierre).toBe(4401);
  });

  test("un socket ya autenticado no puede cambiar de identidad", async () => {
    const admin = await crearPersonal("admin", "admin2@test.com");
    const ws = await autenticado(admin.token);
    await suscribir(ws, ["/topic/admin/caja"]);
    ws.send(JSON.stringify({ type: "auth", token: d.tokenCliente }));
    // Sigue siendo el admin: desactivarlo debe cortarlo.
    await api().patch(`/api/admin/personal/${admin.id}/activo`).set(bearer(d.tokenAdmin)).send({ activo: false });
    expect(await ws.cierre).toBe(4401);
  });

  test("la ruta web vieja de cambio de rol también corta el socket", async () => {
    const mesero = await crearPersonal("mesero", "m2@test.com");
    const ws = await autenticado(mesero.token);
    await api().patch(`/api/usuarios/${mesero.id}/rol`).set(bearer(d.tokenAdmin)).send({ rol_id: "cliente" });
    expect(await ws.cierre).toBe(4403);
  });

  test("un pedido web nuevo y su cambio de estado llegan al admin en vivo", async () => {
    const ws = await autenticado(d.tokenAdmin);
    await suscribir(ws, ["/topic/admin/pedidos", "/topic/admin/pedidos/estado"]);

    const { body: pedido } = await api().post("/api/pedidos").set(bearer(d.tokenCliente))
      .send({ items: [{ menu_item_id: String(d.cafe._id), cantidad: 1 }] });
    const nuevo = await ws.esperar((x) => x.topic === "/topic/admin/pedidos");
    expect(nuevo.data.id).toBe(String(pedido._id));
    expect(nuevo.data.cliente.nombre).toBe("Ana");

    await api().patch(`/api/pedidos/${pedido._id}/estado`).set(bearer(d.tokenAdmin)).send({ estado: "confirmado" });
    const cambio = await ws.esperar((x) => x.topic === "/topic/admin/pedidos/estado");
    expect(cambio.data).toEqual({ id: String(pedido._id), estado: "confirmado", siguientes: ["preparando", "cancelado"] });
    ws.close();
  });

  test("la app del personal en 5174 conecta aunque el .env solo tenga la web (5173)", async () => {
    const corsOriginal = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = "http://localhost:5173";
    try {
      const local = await cliente({ Origin: "http://localhost:5174" });
      local.close();
      const ip = await cliente({ Origin: "http://127.0.0.1:5174" });
      ip.close();
      const rechazo = await cliente({ Origin: "http://malicioso.test" }).catch((e) => e);
      expect(rechazo.status).toBe(403);
    } finally {
      if (corsOriginal === undefined) delete process.env.CORS_ORIGIN;
      else process.env.CORS_ORIGIN = corsOriginal;
    }
  });

  test("enviar a cocina llega en vivo a la cocina", async () => {
    const mesero = await crearPersonal("mesero");
    const cocina = await crearPersonal("cocina");
    const ws = await autenticado(cocina.token);
    await suscribir(ws, ["/topic/cocina"]);

    const m = bearer(mesero.token);
    const mesa = (await api().post("/api/admin/mesas").set(bearer(d.tokenAdmin)).send({ numero: 3 })).body;
    const { body: c } = await api().post("/api/comandas").set(m).send({ mesaId: mesa.id });
    await api().post(`/api/comandas/${c.id}/items`).set(m).send({ menuItemId: String(d.cafe._id) });
    await api().post(`/api/comandas/${c.id}/enviar`).set(m);

    const msg = await ws.esperar((x) => x.type === "message" && x.topic === "/topic/cocina");
    expect(msg.data.id).toBe(c.id);
    expect(msg.data.mesaNumero).toBe(3);
    ws.close();
  });
});
