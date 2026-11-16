const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect } = require("./helpers");
const { ChatIntent, Comanda, Mesa, Reservation, User } = require("../src/models");
const { sincronizarIntenciones } = require("../scripts/sincronizarIntenciones");
const { normalizar, detectarIntencion, respuestasRapidas } = require("../src/services/chatbot");
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
    // Hay varias formas de decir "no entendí".
    expect(res.body.respuesta).toMatch(/entendí|haberte entendido/);
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
    // Hay varias despedidas; sin sesión, ninguna lleva nombre ni la coma que lo precede.
    expect(despedida.body.intencion).toBe("despedida");
    expect(despedida.body.respuesta).toMatch(/^¡(Hasta pronto|Chao|Nos vemos)! /);

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

describe("Chatbot: entiende plurales, errores de escritura y frases sueltas", () => {
  // Se mide la detección sola: por el chat, una frase de reserva deja la
  // conversación dentro de ese flujo y los mensajes siguientes ya no cuentan.
  const intencionDe = async (mensaje) => (await detectarIntencion(mensaje)).nombre;

  test("una palabra suelta o en plural ya no es desconocida", async () => {
    // "reserva" sola se entiende como querer hacer una; "mis reservas" las consulta.
    expect(await intencionDe("reserva")).toBe("crear_reserva");
    expect(await intencionDe("mis reservas")).toBe("mis_reservas");
    expect(await intencionDe("menus")).toBe("menu");
    expect(await intencionDe("menu porfa")).toBe("menu");
    expect(await intencionDe("horarios")).toBe("horario");
  });

  test("tolera un error de dedo en palabras largas, no en las cortas", async () => {
    expect(await intencionDe("orario de atencion")).toBe("desconocida"); // cambia la primera letra
    expect(await intencionDe("cual es el horaro")).toBe("horario");
    expect(await intencionDe("ubicasion")).toBe("ubicacion");
    expect(await intencionDe("grasias")).toBe("agradecimiento");
    // "mesa" y "pago" son cortas: una letra distinta es otra palabra.
    expect(await intencionDe("misa")).toBe("desconocida");
    expect(await intencionDe("xyz abc")).toBe("desconocida");
  });

  test("las distintas formas de pedir una reserva abren el flujo de reserva", async () => {
    for (const frase of ["resevar mesa", "quiero reservar para 4", "¿Cómo hago una reserva?", "quiero apartar una mesa"]) {
      // Las dos intenciones llevan al mismo flujo de reserva.
      expect(["crear_reserva", "hacer_reserva"].includes(await intencionDe(frase))).toBe(true);
    }
    // Y por el chat, la frase con error de escritura de verdad abre la reserva.
    const res = await enviar(d.tokenCliente, "resevar mesa");
    expect(res.body.intencion).toBe("crear_reserva");
    incluye(res.body.respuesta, "¿");
  });

  test("una coincidencia exacta le gana a una aproximada", async () => {
    // "pedido" es exacta para estado_pedido; no debe confundirse con "pedir".
    expect(await intencionDe("pedido")).toBe("estado_pedido");
    expect(await intencionDe("quiero pedir")).toBe("hacer_pedido");
  });
});

describe("Chatbot: permisos de consulta", () => {
  const hoy = () => new Date(`${hoyLocal()}T00:00:00.000Z`);

  beforeEach(async () => {
    const otro = await User.create({ nombre: "Beto", correo: "beto@test.com", password: "secreta1", rol_id: "cliente" });
    await Reservation.create([
      { usuario_id: otro._id, dia: hoy(), hora: "10:30", cupo: 4, estado_reserva: "confirmada" },
      { usuario_id: d.cliente.id, dia: hoy(), hora: "12:00", cupo: 2, estado_reserva: "pendiente" },
    ]);
    await api().post("/api/pedidos").set(bearer(d.tokenCliente))
      .send({ items: [{ menu_item_id: String(d.cafe._id), cantidad: 1 }] });
    const mesa = await Mesa.create({ numero: 1 });
    const admin = await User.findOne({ correo: "admin@test.com" });
    await Comanda.create({ mesa_id: mesa._id, mesero_id: admin._id, estado: "CERRADA", total: 45000, metodo_pago: "EFECTIVO", fecha_cierre: new Date() });
  });

  test("el admin consulta las reservas, los pedidos y las ventas del día", async () => {
    const reservas = await enviar(d.tokenAdmin, "reservas de hoy");
    expect(reservas.body.intencion).toBe("admin_reservas_hoy");
    incluye(reservas.body.respuesta, "Hoy hay 2 reservas para 6 personas");
    incluye(reservas.body.respuesta, "10:30, 4 personas, Beto (confirmada)");

    const pedidos = await enviar(d.tokenAdmin, "cuantos pedidos hay");
    expect(pedidos.body.intencion).toBe("admin_pedidos_pendientes");
    incluye(pedidos.body.respuesta, "Hay 1 pedido web activo");
    incluye(pedidos.body.respuesta, "1 pendiente de confirmación");

    const ventas = await enviar(d.tokenAdmin, "ventas de hoy");
    expect(ventas.body.intencion).toBe("admin_ventas_hoy");
    incluye(ventas.body.respuesta, "1 cuenta en el salón por $45.000");
  });

  test("un cliente nunca recibe datos de otras personas", async () => {
    const reservas = await enviar(d.tokenCliente, "reservas de hoy");
    expect(reservas.body.respuesta.includes("Beto")).toBe(false);
    expect(reservas.body.respuesta.includes("10:30")).toBe(false);
    incluye(reservas.body.respuesta, "12:00"); // solo la suya

    const pedidos = await enviar(d.tokenCliente, "pedidos pendientes");
    incluye(pedidos.body.respuesta, "Tu último pedido");

    const ventas = await enviar(d.tokenCliente, "ventas de hoy");
    expect(ventas.body.respuesta).toBe("Esa información es solo para el equipo del restaurante.");
  });

  test("un visitante sin sesión tampoco: se le pide iniciar sesión", async () => {
    const reservas = await api().post("/api/chat/mensaje").send({ mensaje: "reservas de hoy" });
    incluye(reservas.body.respuesta, "inicia sesión");
    const ventas = await api().post("/api/chat/mensaje").send({ mensaje: "cuanto vendimos" });
    expect(ventas.body.respuesta).toBe("Esa información es solo para el equipo del restaurante.");
  });
});

describe("Chatbot: validaciones nuevas", () => {
  test("rechaza un identificador de conversación mal formado", async () => {
    for (const malo of ["abc", { $ne: null }, 123]) {
      const res = await enviar(d.tokenCliente, "hola", malo);
      expect(res.status).toBe(400);
      expect(res.body.mensaje).toBe("El identificador de la conversación no es válido");
    }
  });

  test("limpia los caracteres de control del mensaje", async () => {
    const res = await enviar(d.tokenCliente, "ho\u0000la\u0007 menu");
    expect(res.status).toBe(200);
    expect(res.body.intencion).toBe("menu");
    const soloControl = await enviar(d.tokenCliente, "\u0000\u0001");
    expect(soloControl.status).toBe(400);
  });

  test("no agenda reservas a más de 90 días", async () => {
    const lejos = new Date(`${hoyLocal()}T00:00:00.000Z`);
    lejos.setUTCDate(lejos.getUTCDate() + 120);
    const [anio, mes, dia] = lejos.toISOString().slice(0, 10).split("-");
    await enviar(d.tokenCliente, "quiero reservar");
    const res = await enviar(d.tokenCliente, `el ${dia}/${mes}/${anio}`);
    incluye(res.body.respuesta, "máximo 90 días de anticipación");
  });
});

describe("Chatbot: charla, variedad y sugerencias", () => {
  const visitante = (mensaje, anterior) => api().post("/api/chat/mensaje").send({ mensaje, anterior });

  test("si saluda y además pregunta algo, gana la pregunta y se devuelve el saludo", async () => {
    const res = await visitante("hola, a que hora abren?");
    expect(res.body.intencion).toBe("horario");
    expect(res.body.respuesta.startsWith("¡Hola! ")).toBe(true);

    const conSesion = await enviar(d.tokenCliente, "buenas, gracias, quiero ver el menu");
    expect(conSesion.body.intencion).toBe("menu");
    expect(conSesion.body.respuesta.startsWith("¡Hola, Ana! Este es nuestro menú")).toBe(true);

    // Solo charla: sigue siendo charla.
    expect((await visitante("muchas gracias")).body.intencion).toBe("agradecimiento");
    expect((await visitante("hola, que tal")).body.intencion).toBe("como_estas");
  });

  test("no repite la respuesta que acaba de dar", async () => {
    // Sin sesión, la página manda lo último que dijo el bot.
    let anterior;
    for (let i = 0; i < 8; i += 1) {
      const res = await visitante("gracias", anterior);
      expect(res.body.respuesta === anterior).toBe(false);
      anterior = res.body.respuesta;
    }

    // Con sesión, lo recuerda la conversación guardada.
    let ultima;
    for (let i = 0; i < 8; i += 1) {
      const res = await enviar(d.tokenCliente, "gracias");
      expect(res.body.respuesta === ultima).toBe(false);
      ultima = res.body.respuesta;
    }

    // Con una sola respuesta posible no hay más remedio que repetirla.
    const pago = await visitante("donde quedan");
    expect((await visitante("donde quedan", pago.body.respuesta)).body.respuesta).toBe(pago.body.respuesta);
  });

  test("cada sugerencia lleva a la intención que promete", async () => {
    const DESTINO = {
      "Ver el menú": "menu",
      "Quiero hacer una reserva": "crear_reserva",
      "¿Cuál es el horario?": "horario",
      "¿Qué me recomiendas?": "recomendacion",
      "¿Cómo hago un pedido?": "hacer_pedido",
      "¿Qué métodos de pago aceptan?": "metodos_pago",
      "¿Dónde quedan?": "ubicacion",
      "¿Cómo va mi pedido?": "estado_pedido",
      "Editar mi reserva": "editar_reserva",
      "Cancelar mi reserva": "cancelar_reserva",
    };
    const usadas = new Set(INTENCIONES.flatMap((i) => i.sugerencias ?? []));
    // Se prueba como lo haría la página (sin sesión, cada mensaje va solo): las
    // de reservas no las decide la detección de intenciones sino su propio flujo.
    for (const sugerencia of usadas) {
      const { body } = await visitante(sugerencia);
      expect(`${sugerencia} -> ${body.intencion}`).toBe(`${sugerencia} -> ${DESTINO[sugerencia]}`);
    }
  });

  test("la respuesta trae sugerencias: las del tema o lo que pide contestar", async () => {
    const horario = await visitante("cual es el horario");
    expect(horario.body.sugerencias).toEqual(["Quiero hacer una reserva", "¿Dónde quedan?"]);

    const rara = await visitante("xyzzy plugh");
    expect(rara.body.intencion).toBe("desconocida");
    expect(rara.body.sugerencias).toHaveLength(4);

    // Un paso de la reserva: los botones salen de lo que la respuesta pone entre « ».
    const reserva = await enviar(d.tokenCliente, "quiero reservar");
    expect(reserva.body.sugerencias).toEqual(["Mañana"]);
    expect(respuestasRapidas("Dime «sí» para seguir o «no» para conservarla. Repito: «sí».")).toEqual(["Sí", "No"]);
    expect(respuestasRapidas("Sin opciones")).toEqual([]);
  });

  test("recomienda un plato de la carta de la web", async () => {
    const res = await visitante("que me recomiendas?");
    expect(res.body.intencion).toBe("recomendacion");
    expect(/(Huevos \(\$20\.000\)|Café \(\$5\.000\))/.test(res.body.respuesta)).toBe(true);
    expect(res.body.respuesta.includes("Viejo")).toBe(false);
  });
});

describe("Chatbot: preguntas sobre la carta", () => {
  const visitante = async (mensaje) => (await api().post("/api/chat/mensaje").send({ mensaje })).body;

  // La carta de las pruebas: Huevos ($20.000, plato) y Café ($5.000, bebida).
  test("si lo que piden está en la carta, lo dice con su precio", async () => {
    for (const pregunta of ["venden cafe?", "¿Tienen café?", "cuanto cuesta el café", "un cafe porfa", "cafes"]) {
      const res = await visitante(pregunta);
      expect(`${pregunta} -> ${res.intencion}`).toBe(`${pregunta} -> consulta_producto`);
      expect(res.respuesta).toBe("¡Sí! Tenemos Café a $5.000.");
    }
    expect((await visitante("hola, venden huevos?")).respuesta).toBe("¡Hola! ¡Sí! Tenemos Huevos a $20.000.");
    // "Precio" solo activaría el menú entero; nombrando el plato responde por él.
    expect((await visitante("precio del cafe")).respuesta).toBe("¡Sí! Tenemos Café a $5.000.");
  });

  test("si no está, avisa que no se vende y ofrece lo que hay de ese tipo", async () => {
    const cerveza = await visitante("venden cerveza?");
    expect(cerveza.intencion).toBe("consulta_producto");
    expect(cerveza.respuesta).toBe("Por ahora no vendemos cerveza. En bebidas tenemos Café ($5.000).");
    expect(cerveza.sugerencias).toEqual(["Ver el menú", "¿Qué me recomiendas?"]);

    // Sin "venden": basta con que sea una comida o bebida conocida.
    expect((await visitante("cerveza?")).respuesta).toMatch(/^Por ahora no vendemos cerveza\./);
    expect((await visitante("tienen pizza?")).respuesta).toBe("Por ahora no vendemos pizza. En platos tenemos Huevos ($20.000).");
    // De ese tipo no hay nada en la carta.
    expect((await visitante("venden helado?")).respuesta).toBe("Por ahora no vendemos helado. Si quieres, te muestro lo que sí tenemos.");
    // Pregunta clara de venta por algo que no está en el vocabulario.
    expect((await visitante("venden zapatos?")).respuesta).toMatch(/^Por ahora no vendemos zapatos\./);
  });

  test("ofrece lo parecido y las secciones enteras", async () => {
    const parecido = await visitante("venden cafe helado?");
    expect(parecido.respuesta).toBe("No tenemos exactamente «cafe helado», pero esto se le parece:\n- Café: $5.000");

    const seccion = await visitante("que bebidas tienen?");
    expect(seccion.respuesta).toBe("¡Claro! Esto es lo que tenemos:\n- Café: $5.000");
  });

  test("lo que está oculto en la web no se ofrece", async () => {
    await api().post("/api/admin/menu").set(bearer(d.tokenAdmin)).send({
      nombre: "Cerveza artesanal", precio: 12000, disponible: true, visibleWeb: false, visibleSalon: true,
      categoriaId: String(d.categoria._id), imagenUrl: null, descripcion: "",
    });
    expect((await visitante("venden cerveza?")).respuesta).toMatch(/^Por ahora no vendemos cerveza\./);
  });

  test("no se mete donde no es una pregunta por un producto", async () => {
    const intencionDe = async (mensaje) => (await visitante(mensaje)).intencion;
    // Cosas que no son comida, con verbos que también se usan para comida.
    expect(await intencionDe("tienen parqueadero?")).toBe("desconocida");
    expect(await intencionDe("quiero hablar con alguien")).toBe("desconocida");
    // Otros temas, aunque usen "tienen", "hay" o nombren un plato.
    expect(await intencionDe("que tienen en el menu")).toBe("menu");
    expect(await intencionDe("a que hora abren")).toBe("horario");
    expect(await intencionDe("como va mi pedido de huevos")).toBe("estado_pedido");
    expect(await intencionDe("muchas gracias")).toBe("agradecimiento");
    expect(await intencionDe("tienen mesa para mañana?")).toBe("crear_reserva");
    // Una frase larga que nombra un plato no es una pregunta por él.
    expect((await intencionDe("ayer me atendieron muy mal con el cafe")) === "consulta_producto").toBe(false);
  });
});

describe("Chatbot: sincronizar intenciones con la base", () => {
  test("con --respuestas agrega las respuestas y sugerencias que falten, sin borrar las del admin", async () => {
    await ChatIntent.updateOne(
      { nombre: "agradecimiento" },
      { $set: { respuestas: [{ tipo: "texto", respuesta: "Texto del admin" }, { tipo: "texto", respuesta: "¡Con gusto! ¿Te ayudo con algo más?" }] } }
    );
    await ChatIntent.updateOne({ nombre: "horario" }, { $set: { sugerencias: [] } });
    await ChatIntent.updateOne({ nombre: "saludo" }, { $set: { sugerencias: ["La del admin"] } });

    // Sin la opción, las respuestas no se miran.
    expect(await sincronizarIntenciones()).toEqual([]);

    const simulacion = await sincronizarIntenciones({ respuestas: true });
    expect(simulacion.map((c) => `${c.intencion}: ${c.cambio}`).sort()).toEqual([
      "agradecimiento: agregar respuestas",
      "horario: poner sugerencias",
    ]);

    await sincronizarIntenciones({ respuestas: true, confirmar: true });
    const gracias = await ChatIntent.findOne({ nombre: "agradecimiento" }).lean();
    expect(gracias.respuestas.map((r) => r.respuesta)).toEqual([
      "Texto del admin",
      "¡Con gusto! ¿Te ayudo con algo más?",
      "¡A ti! Aquí sigo si necesitas algo más.",
      "¡Para eso estoy! Si se te ocurre otra cosa, me escribes.",
    ]);
    expect((await ChatIntent.findOne({ nombre: "horario" }).lean()).sugerencias).toHaveLength(2);
    expect((await ChatIntent.findOne({ nombre: "saludo" }).lean()).sugerencias).toEqual(["La del admin"]);
    expect(await sincronizarIntenciones({ respuestas: true })).toEqual([]);
  });

  test("agrega lo que falta sin pisar lo que el admin editó", async () => {
    // Estado de una base antigua: falta una intención y otra tiene menos palabras clave y una respuesta editada.
    await ChatIntent.deleteOne({ nombre: "admin_ventas_hoy" });
    await ChatIntent.updateOne(
      { nombre: "crear_reserva" },
      { $set: { palabras_clave: ["reservar", "palabra del admin"], respuestas: [{ tipo: "texto", respuesta: "Texto editado por el admin" }] } }
    );

    const simulacion = await sincronizarIntenciones();
    expect(simulacion.map((c) => c.intencion).sort()).toEqual(["admin_ventas_hoy", "crear_reserva"]);
    expect(await ChatIntent.countDocuments({ nombre: "admin_ventas_hoy" })).toBe(0); // la simulación no escribe

    await sincronizarIntenciones({ confirmar: true });
    expect(await ChatIntent.countDocuments({ nombre: "admin_ventas_hoy" })).toBe(1);
    const reserva = await ChatIntent.findOne({ nombre: "crear_reserva" }).lean();
    expect(reserva.palabras_clave.includes("palabra del admin")).toBe(true);
    expect(reserva.palabras_clave.includes("una reserva")).toBe(true);
    expect(reserva.respuestas[0].respuesta).toBe("Texto editado por el admin");

    // Ya al día: no queda nada pendiente.
    expect(await sincronizarIntenciones()).toEqual([]);
  });
});
