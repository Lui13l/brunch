const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect } = require("./helpers");
const { ChatIntent } = require("../src/models");
const { normalizar } = require("../src/services/chatbot");
const INTENCIONES = require("../src/data/intenciones");
const { hoyLocal } = require("../src/utils/tiempo");

let d;

const mananaLocal = () => {
  const fecha = new Date(`${hoyLocal()}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString().slice(0, 10);
};

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
    expect(sinPedidos.body.respuesta).toBe("Aún no tienes pedidos. Cuando hagas uno, puedo ayudarte a revisar cómo va.");

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
    expect(vacio.body.respuesta).toBe("No veo reservas próximas a tu nombre. Si quieres, puedo ayudarte a agendar una.");

    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await api().post("/api/reservas").set(bearer(d.tokenCliente)).send({ dia: manana, hora: "11:00", cupo: 3 });

    const res = await enviar(d.tokenCliente, "mis reservas");
    incluye(res.body.respuesta, `${manana} a las 11:00, para 3 personas`);
  });

  test("el chat recopila datos, confirma y guarda la reserva pendiente", async () => {
    const fecha = mananaLocal();
    const inicio = await enviar(d.tokenCliente, "quiero reservar");
    expect(inicio.body.intencion).toBe("crear_reserva");
    incluye(inicio.body.respuesta, "fecha");

    const fechaHora = await enviar(d.tokenCliente, "mañana a las 12:00");
    incluye(fechaHora.body.respuesta, "personas vienen");

    const confirmacion = await enviar(d.tokenCliente, "4");
    incluye(confirmacion.body.respuesta, "ocasión especial");

    const ocasion = await enviar(d.tokenCliente, "cumpleaños");
    incluye(ocasion.body.respuesta, "nota adicional");

    const notas = await enviar(d.tokenCliente, "Necesitamos una silla para bebé");
    incluye(notas.body.respuesta, "¿Te la reservo?");

    const guardada = await enviar(d.tokenCliente, "sí");
    incluye(guardada.body.respuesta, "confirmará pronto");
    const reservas = await api().get("/api/reservas/mis-reservas").set(bearer(d.tokenCliente));
    expect(reservas.body).toHaveLength(1);
    expect(reservas.body[0].dia.slice(0, 10)).toBe(fecha);
    expect(reservas.body[0].hora).toBe("12:00");
    expect(reservas.body[0].cupo).toBe(4);
    expect(reservas.body[0].ocasion).toBe("cumpleaños");
    expect(reservas.body[0].detalles).toBe("Necesitamos una silla para bebé");
    expect(reservas.body[0].estado_reserva).toBe("pendiente");
  });

  test("guarda la reserva aunque el cliente no tenga ocasión ni notas", async () => {
    await enviar(d.tokenCliente, "quiero reservar");
    await enviar(d.tokenCliente, "mañana a las 12:00");
    incluye((await enviar(d.tokenCliente, "2")).body.respuesta, "ocasión especial");
    incluye((await enviar(d.tokenCliente, "ninguna")).body.respuesta, "nota adicional");
    incluye((await enviar(d.tokenCliente, "no")).body.respuesta, "¿Te la reservo?");
    await enviar(d.tokenCliente, "sí");

    const reservas = await api().get("/api/reservas/mis-reservas").set(bearer(d.tokenCliente));
    expect(reservas.body).toHaveLength(1);
    expect(reservas.body[0].ocasion).toBe("Sin ocasión");
    expect(reservas.body[0].detalles).toBe("");
  });

  test("rechaza reservas del chat que exceden la capacidad del horario", async () => {
    const fecha = mananaLocal();
    await api().post("/api/reservas").set(bearer(d.tokenCliente)).send({
      dia: fecha,
      hora: "12:00",
      cupo: 20,
    });

    const inicio = await enviar(d.tokenCliente, "quiero reservar");
    const fechaHora = await enviar(d.tokenCliente, `${fecha} a las 12:00`);
    const cupo = await enviar(d.tokenCliente, "15");
    incluye(cupo.body.respuesta, "ocasión especial");
    const ocasion = await enviar(d.tokenCliente, "reunión");
    incluye(ocasion.body.respuesta, "nota adicional");
    const respuesta = await enviar(d.tokenCliente, "no");
    expect(inicio.status).toBe(200);
    expect(fechaHora.status).toBe(200);
    incluye(respuesta.body.respuesta, "solo quedan 10");
    expect((await api().get("/api/reservas/mis-reservas").set(bearer(d.tokenCliente))).body).toHaveLength(1);
  });

  test("valida entradas de fecha, hora y cantidad durante la reserva", async () => {
    const pasado = new Date(`${hoyLocal()}T00:00:00.000Z`);
    pasado.setUTCDate(pasado.getUTCDate() - 1);
    const fechaPasada = pasado.toISOString().slice(0, 10);
    const inicio = await enviar(d.tokenCliente, "quiero reservar");
    incluye(inicio.body.respuesta, "fecha");

    const numeroTemprano = await enviar(d.tokenCliente, "3");
    incluye(numeroTemprano.body.respuesta, "fecha");
    expect((await api().get("/api/reservas/mis-reservas").set(bearer(d.tokenCliente))).body).toHaveLength(0);

    const fechaInvalida = await enviar(d.tokenCliente, "31/02/2026");
    incluye(fechaInvalida.body.respuesta, "fecha");

    const fechaAntigua = await enviar(d.tokenCliente, fechaPasada);
    incluye(fechaAntigua.body.respuesta, "ya pasó");

    const horaInvalida = await enviar(d.tokenCliente, `${mananaLocal()} a las 25:00`);
    incluye(horaInvalida.body.respuesta, "hora");
    const horaValida = await enviar(d.tokenCliente, "12:00");
    incluye(horaValida.body.respuesta, "personas vienen");

    const textoCantidad = await enviar(d.tokenCliente, "varias");
    incluye(textoCantidad.body.respuesta, "personas vienen");
    const cantidadDecimal = await enviar(d.tokenCliente, "3.5");
    incluye(cantidadDecimal.body.respuesta, "personas vienen");
    const cantidadCero = await enviar(d.tokenCliente, "0");
    incluye(cantidadCero.body.respuesta, "número entero");
    const cantidadNegativa = await enviar(d.tokenCliente, "-1");
    incluye(cantidadNegativa.body.respuesta, "número entero");
    const cantidadNegativaConTexto = await enviar(d.tokenCliente, "-1 personas");
    incluye(cantidadNegativaConTexto.body.respuesta, "número entero");
    const cantidadSobreLimite = await enviar(d.tokenCliente, "31");
    incluye(cantidadSobreLimite.body.respuesta, "hasta 30");

    const cantidadMaxima = await enviar(d.tokenCliente, "30");
    incluye(cantidadMaxima.body.respuesta, "ocasión especial");
    incluye((await enviar(d.tokenCliente, "ninguna")).body.respuesta, "nota adicional");
    incluye((await enviar(d.tokenCliente, "no")).body.respuesta, "¿Te la reservo?");
    await enviar(d.tokenCliente, "no");
    expect((await api().get("/api/reservas/mis-reservas").set(bearer(d.tokenCliente))).body).toHaveLength(0);
  });

  test("el chat rechaza horas fuera de atención y horas que ya pasaron", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-13T15:00:00Z") });
    await enviar(d.tokenCliente, "quiero reservar");

    const fueraDeHorario = await enviar(d.tokenCliente, "mañana a las 08:00");
    incluye(fueraDeHorario.body.respuesta, "fuera de atención");

    const horaPasada = await enviar(d.tokenCliente, "hoy a las 09:59");
    incluye(horaPasada.body.respuesta, "ya pasó");

    const horaFutura = await enviar(d.tokenCliente, "10:30");
    incluye(horaFutura.body.respuesta, "personas vienen");
    expect((await api().get("/api/reservas/mis-reservas").set(bearer(d.tokenCliente))).body).toHaveLength(0);
  });

  test("el cliente puede cancelar por chat y el admin ve el estado cancelado", async () => {
    const reserva = await api()
      .post("/api/reservas")
      .set(bearer(d.tokenCliente))
      .send({ dia: mananaLocal(), hora: "12:00", cupo: 2 });
    expect(reserva.status).toBe(201);

    const pregunta = await enviar(d.tokenCliente, "quiero cancelar mi reserva");
    expect(pregunta.body.intencion).toBe("cancelar_reserva");
    incluye(pregunta.body.respuesta, "¿Quieres cancelar");

    const confirmacion = await enviar(d.tokenCliente, "sí");
    incluye(confirmacion.body.respuesta, "Cancelé tu reserva");

    const canceladas = await api().get("/api/reservas?estado=cancelada").set(bearer(d.tokenAdmin));
    expect(canceladas.body).toHaveLength(1);
    expect(canceladas.body[0].estado_reserva).toBe("cancelada");
  });

  test("el chat permite modificar una reserva y confirmar los cambios", async () => {
    const fecha = mananaLocal();
    await api()
      .post("/api/reservas")
      .set(bearer(d.tokenCliente))
      .send({ dia: fecha, hora: "10:00", cupo: 2 });

    const inicio = await enviar(d.tokenCliente, "editar mi reserva");
    incluye(inicio.body.respuesta, "Dime qué quieres cambiar");

    const fueraDeHorario = await enviar(d.tokenCliente, "mañana a las 23:00 para 4 personas");
    incluye(fueraDeHorario.body.respuesta, "fuera de atención");

    const cambios = await enviar(d.tokenCliente, "mañana a las 12:00 para 4 personas");
    incluye(cambios.body.respuesta, "¿Los guardamos?");

    const confirmacion = await enviar(d.tokenCliente, "sí");
    incluye(confirmacion.body.respuesta, "Actualicé tu reserva");

    const reservas = await api().get("/api/reservas/mis-reservas").set(bearer(d.tokenCliente));
    expect(reservas.body).toHaveLength(1);
    expect(reservas.body[0].dia.slice(0, 10)).toBe(fecha);
    expect(reservas.body[0].hora).toBe("12:00");
    expect(reservas.body[0].cupo).toBe(4);
  });

  test("el chat reconoce distintas formas de pedir una cancelación", async () => {
    for (const [indice, frase] of ["cancela la reserva", "quiero cancelarla", "cancelar"].entries()) {
      await api()
        .post("/api/reservas")
        .set(bearer(d.tokenCliente))
        .send({ dia: mananaLocal(), hora: `${12 + indice}:00`, cupo: 2 });

      const pregunta = await enviar(d.tokenCliente, frase);
      expect(pregunta.body.intencion).toBe("cancelar_reserva");
      incluye(pregunta.body.respuesta, "¿Quieres cancelar");

      const confirmacion = await enviar(d.tokenCliente, "sí");
      incluye(confirmacion.body.respuesta, "Cancelé tu reserva");
    }
  });

  test("el visitante debe iniciar sesión para agendar desde el chat", async () => {
    const respuesta = await api().post("/api/chat/mensaje").send({ mensaje: "quiero reservar" });
    expect(respuesta.status).toBe(200);
    incluye(respuesta.body.respuesta, "inicia sesión");
    expect(respuesta.body.conversacion_id).toBe(null);
  });

  test("sin coincidencias responde con la intención desconocida", async () => {
    const res = await enviar(d.tokenCliente, "xyz abc");
    expect(res.body.intencion).toBe("desconocida");
    incluye(res.body.respuesta, "entendí bien");
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
    incluye(pedido.body.respuesta, "inicia sesión");

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
