const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect } = require("./helpers");
const { ChatIntent } = require("../src/models");
const { normalizar } = require("../src/services/chatbot");
const INTENCIONES = require("../src/data/intenciones");

let d;

before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);
beforeEach(async () => {
  await limpiar();
  d = await datosBase();
  await ChatIntent.create(INTENCIONES);
});

const enviar = (token, mensaje, conversacion_id) =>
  api().post("/api/chat/mensaje").set(bearer(token)).send({ mensaje, conversacion_id });

const incluye = (texto, fragmento) => expect(texto.includes(fragmento)).toBe(true);

describe("Chatbot: detección de intenciones", () => {
  test("normaliza mayúsculas, tildes y signos", () => {
    expect(normalizar("¿Qué hay en el MENÚ?")).toBe("que hay en el menu");
  });

  test("saludo usa el nombre del usuario", async () => {
    const res = await enviar(d.tokenCliente, "Hola, buenos días");
    expect(res.status).toBe(200);
    expect(res.body.intencion).toBe("saludo");
    incluye(res.body.respuesta, "Ana");
  });

  test("menú lista los productos activos agrupados por categoría", async () => {
    const res = await enviar(d.tokenCliente, "¿Qué hay en el menú?");
    expect(res.body.intencion).toBe("menu");
    incluye(res.body.respuesta, "Platos:");
    incluye(res.body.respuesta, "Huevos: $20.000");
    expect(res.body.respuesta.includes("Viejo")).toBe(false);
  });

  test("la frase más larga gana: 'hacer un pedido' no es 'estado del pedido'", async () => {
    const res = await enviar(d.tokenCliente, "Quiero hacer un pedido");
    expect(res.body.intencion).toBe("hacer_pedido");
  });

  test("estado del pedido usa los datos reales del usuario", async () => {
    const sinPedidos = await enviar(d.tokenCliente, "¿Cómo va mi pedido?");
    expect(sinPedidos.body.intencion).toBe("estado_pedido");
    expect(sinPedidos.body.respuesta).toBe("Todavía no tienes pedidos.");

    await api()
      .post("/api/pedidos")
      .set(bearer(d.tokenCliente))
      .send({ items: [{ menu_item_id: d.huevos.id, cantidad: 2 }] });

    const conPedido = await enviar(d.tokenCliente, "¿Cómo va mi pedido?");
    incluye(conPedido.body.respuesta, "2x Huevos");
    incluye(conPedido.body.respuesta, "pendiente de confirmación");
  });

  test("mis reservas muestra solo las próximas", async () => {
    const vacio = await enviar(d.tokenCliente, "mis reservas");
    expect(vacio.body.respuesta).toBe("No tienes reservas próximas.");

    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await api().post("/api/reservas").set(bearer(d.tokenCliente)).send({ dia: manana, hora: "11:00", cupo: 3 });

    const res = await enviar(d.tokenCliente, "mis reservas");
    incluye(res.body.respuesta, `${manana} a las 11:00 para 3 persona(s)`);
  });

  test("sin coincidencias responde con la intención desconocida", async () => {
    const res = await enviar(d.tokenCliente, "xyz abc");
    expect(res.body.intencion).toBe("desconocida");
    incluye(res.body.respuesta, "no entendí");
  });

  test("sin intenciones cargadas usa una respuesta por defecto", async () => {
    await ChatIntent.deleteMany({});
    const res = await enviar(d.tokenCliente, "hola");
    expect(res.status).toBe(200);
    expect(res.body.intencion).toBe("desconocida");
  });
});

describe("Chatbot: conversaciones", () => {
  test("valida el mensaje", async () => {
    expect((await enviar(d.tokenCliente, "   ")).status).toBe(400);
    expect((await enviar(d.tokenCliente, "a".repeat(501))).status).toBe(400);
  });

  test("un visitante sin sesión recibe respuesta, pero no se guarda la conversación", async () => {
    const visitante = (mensaje) => api().post("/api/chat/mensaje").send({ mensaje });

    const saludo = await visitante("hola");
    expect(saludo.status).toBe(200);
    expect(saludo.body.conversacion_id).toBe(null);
    expect(saludo.body.respuesta.startsWith("¡Hola!")).toBe(true);

    const menu = await visitante("que hay en el menu");
    incluye(menu.body.respuesta, "Huevos: $20.000");

    const pedido = await visitante("como va mi pedido");
    incluye(pedido.body.respuesta, "Inicia sesión");

    const horario = await visitante("a que hora abren");
    expect(horario.body.intencion).toBe("horario");

    const despedida = await visitante("chao");
    expect(despedida.body.respuesta).toBe("¡Hasta pronto! Que disfrutes tu brunch.");

    const { ChatConversation } = require("../src/models");
    expect(await ChatConversation.countDocuments()).toBe(0);
  });

  test("los mensajes se guardan en la misma conversación activa", async () => {
    const primero = await enviar(d.tokenCliente, "hola");
    const segundo = await enviar(d.tokenCliente, "gracias");
    expect(segundo.body.conversacion_id).toBe(primero.body.conversacion_id);

    const conv = await api()
      .get(`/api/chat/conversaciones/${primero.body.conversacion_id}`)
      .set(bearer(d.tokenCliente));
    expect(conv.body.mensajes.map((m) => m.tipo)).toEqual(["usuario", "bot", "usuario", "bot"]);
    expect(conv.body.contexto.datos.ultima_intencion).toBe("agradecimiento");
  });

  test("al finalizar, el siguiente mensaje abre una conversación nueva", async () => {
    const { conversacion_id } = (await enviar(d.tokenCliente, "hola")).body;

    const fin = await api()
      .patch(`/api/chat/conversaciones/${conversacion_id}/finalizar`)
      .set(bearer(d.tokenCliente));
    expect(fin.body.estado).toBe("finalizada");

    expect((await enviar(d.tokenCliente, "hola", conversacion_id)).status).toBe(400);

    const nueva = await enviar(d.tokenCliente, "hola");
    expect(nueva.body.conversacion_id === conversacion_id).toBe(false);

    const lista = await api().get("/api/chat/conversaciones").set(bearer(d.tokenCliente));
    expect(lista.body).toHaveLength(2);
    expect(lista.body[0].mensajes).toBeUndefined();
  });

  test("un usuario no puede leer ni escribir en conversaciones ajenas", async () => {
    const { conversacion_id } = (await enviar(d.tokenAdmin, "hola")).body;

    expect((await api().get(`/api/chat/conversaciones/${conversacion_id}`).set(bearer(d.tokenCliente))).status).toBe(403);
    expect((await enviar(d.tokenCliente, "hola", conversacion_id)).status).toBe(403);
  });

  test("el admin puede ver las conversaciones de todos", async () => {
    await enviar(d.tokenCliente, "hola");
    await enviar(d.tokenAdmin, "hola");

    const propias = await api().get("/api/chat/conversaciones").set(bearer(d.tokenAdmin));
    expect(propias.body).toHaveLength(1);
    const todas = await api().get("/api/chat/conversaciones?todas=true").set(bearer(d.tokenAdmin));
    expect(todas.body).toHaveLength(2);
  });
});

describe("Chatbot: administración de intenciones", () => {
  test("solo el admin gestiona intenciones", async () => {
    expect((await api().get("/api/chat/intenciones").set(bearer(d.tokenCliente))).status).toBe(403);

    const lista = await api().get("/api/chat/intenciones").set(bearer(d.tokenAdmin));
    expect(lista.body).toHaveLength(INTENCIONES.length);
  });

  test("una intención nueva se usa de inmediato y se puede desactivar", async () => {
    const creada = await api()
      .post("/api/chat/intenciones")
      .set(bearer(d.tokenAdmin))
      .send({
        nombre: "zonas_entrega",
        palabras_clave: ["zonas de entrega", "cobertura"],
        respuestas: [{ respuesta: "Entregamos en todo el centro de la ciudad." }],
      });
    expect(creada.status).toBe(201);
    expect(creada.body.respuestas[0].tipo).toBe("texto");

    const res = await enviar(d.tokenCliente, "¿Cuáles son las zonas de entrega?");
    expect(res.body.intencion).toBe("zonas_entrega");
    expect(res.body.respuesta).toBe("Entregamos en todo el centro de la ciudad.");

    await api()
      .put(`/api/chat/intenciones/${creada.body.id}`)
      .set(bearer(d.tokenAdmin))
      .send({ activa: false });
    expect((await enviar(d.tokenCliente, "cobertura")).body.intencion).toBe("desconocida");
  });

  test("nombre duplicado devuelve 409 y borrar devuelve 204", async () => {
    const dup = await api()
      .post("/api/chat/intenciones")
      .set(bearer(d.tokenAdmin))
      .send({ nombre: "saludo" });
    expect(dup.status).toBe(409);

    const saludo = await ChatIntent.findOne({ nombre: "saludo" });
    const borrar = await api().delete(`/api/chat/intenciones/${saludo.id}`).set(bearer(d.tokenAdmin));
    expect(borrar.status).toBe(204);
  });
});
