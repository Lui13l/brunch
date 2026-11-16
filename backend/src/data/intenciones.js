// Intenciones iniciales del chatbot que carga "npm run seed".
// Las respuestas pueden usar {nombre}, {menu}, {recomendacion}, {ultimo_pedido}
// y {mis_reservas}.
// {reservas_hoy}, {pedidos_pendientes} y {ventas_hoy} son consultas del negocio:
// solo un admin con sesión recibe esos datos (ver services/chatbot.js).
// Se pueden editar después desde /api/chat/intenciones sin tocar código.
//
// Cada tema tiene varias respuestas para que el chat no suene a grabación: se
// elige una al azar y no se repite la que acaba de decir. `sugerencias` son
// las preguntas que se ofrecen como botones después de responder; cada una
// tiene que activar la intención que promete (hay una prueba que lo revisa).
const texto = (respuesta) => ({ tipo: "texto", respuesta });

module.exports = [
  {
    nombre: "saludo",
    descripcion: "El usuario saluda",
    palabras_clave: ["hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "hey"],
    respuestas: [
      texto("¡Hola {nombre}! Soy el asistente de Brunch & Co. Estoy aquí para ayudarte con el menú, tus pedidos o tus reservas."),
      texto("¡Hola {nombre}! ¿Qué necesitas? Puedo ayudarte con el menú, tus pedidos o tus reservas."),
      texto("¡Hola {nombre}! Qué gusto saludarte. Cuéntame qué se te antoja o en qué te ayudo."),
    ],
    sugerencias: ["Ver el menú", "Quiero hacer una reserva", "¿Cuál es el horario?"],
  },
  {
    nombre: "menu",
    descripcion: "Pregunta por la carta o los precios",
    palabras_clave: ["menu", "carta", "que tienen", "que hay", "que venden", "que ofrecen", "que sirven", "productos", "platos", "comida", "bebidas", "precios", "precio"],
    respuestas: [texto("{menu}")],
    sugerencias: ["¿Qué me recomiendas?", "¿Cómo hago un pedido?", "¿Qué métodos de pago aceptan?"],
  },
  {
    nombre: "hacer_pedido",
    descripcion: "Quiere saber cómo pedir",
    palabras_clave: ["hacer un pedido", "como hago un pedido", "quiero pedir", "como pido", "pedir", "ordenar"],
    respuestas: [
      texto("Para hacer un pedido elige tus productos en el menú de la página e indica la dirección de entrega. Si quieres ver lo que tenemos, escribe \"menú\"."),
      texto("Es fácil: entra al menú de la página, agrega lo que quieras al carrito y dinos a dónde te lo llevamos. Si quieres, te muestro la carta aquí mismo."),
    ],
    sugerencias: ["Ver el menú", "¿Qué métodos de pago aceptan?"],
  },
  {
    nombre: "estado_pedido",
    descripcion: "Pregunta por su último pedido",
    palabras_clave: ["pedido", "mi pedido", "estado de mi pedido", "donde esta mi pedido", "orden", "domicilio"],
    respuestas: [texto("{ultimo_pedido}")],
    sugerencias: ["Ver el menú", "¿Cuál es el horario?"],
  },
  {
    nombre: "crear_reserva",
    descripcion: "Quiere agendar una reserva desde el chatbot",
    palabras_clave: [
      "reservar una mesa",
      "quiero reservar",
      "hacer una reserva",
      "agendar una reserva",
      "reservar",
      "una reserva",
      "hago una reserva",
      "como reservo",
      "reservo",
      "apartar",
      "apartar mesa",
      "mesa para",
    ],
    respuestas: [texto("¡Claro! Te ayudo a organizar tu visita. Cuéntame qué día y a qué hora te gustaría venir, y cuántas personas serán.")],
  },
  {
    nombre: "editar_reserva",
    descripcion: "Quiere modificar una reserva",
    palabras_clave: [
      "editar reserva",
      "editar mi reserva",
      "modificar reserva",
      "modificar mi reserva",
      "cambiar reserva",
      "cambiar mi reserva",
      "cambiar la reserva",
      "quiero editar",
      "quiero modificar",
      "quiero cambiar",
      "actualizar mi reserva",
    ],
    respuestas: [texto("¡Claro! Puedo ayudarte a cambiar la fecha, la hora o la cantidad de personas de una reserva.")],
  },
  {
    nombre: "cancelar_reserva",
    descripcion: "Quiere cancelar una reserva",
    palabras_clave: [
      "cancelar",
      "cancela",
      "cancelar reserva",
      "cancelar la reserva",
      "cancelar mi reserva",
      "cancelar reservas",
      "cancela la reserva",
      "quiero cancelarla",
      "anular reserva",
    ],
    respuestas: [texto("¡Claro! Revisemos tus reservas y vemos cuál quieres cancelar.")],
  },
  {
    nombre: "hacer_reserva",
    descripcion: "Quiere reservar una mesa",
    palabras_clave: ["reservar", "quiero reservar", "hacer una reserva", "mesa", "reservacion"],
    respuestas: [
      texto("¡Con gusto te ayudo a agendarla! Dime qué día y a qué hora te queda bien, y cuántas personas vienen."),
    ],
  },
  {
    nombre: "mis_reservas",
    descripcion: "Pregunta por sus reservas",
    palabras_clave: ["mis reservas", "mi reserva", "reservas", "tengo reserva"],
    respuestas: [texto("{mis_reservas}")],
    sugerencias: ["Quiero hacer una reserva", "Editar mi reserva", "Cancelar mi reserva"],
  },
  {
    nombre: "admin_reservas_hoy",
    descripcion: "El equipo pregunta por las reservas del día (solo admin)",
    palabras_clave: ["reservas de hoy", "reservas para hoy", "reservas hoy", "cuantas reservas hay"],
    respuestas: [texto("{reservas_hoy}")],
  },
  {
    nombre: "admin_pedidos_pendientes",
    descripcion: "El equipo pregunta por los pedidos web activos (solo admin)",
    palabras_clave: ["pedidos pendientes", "pedidos por confirmar", "pedidos activos", "cuantos pedidos hay"],
    respuestas: [texto("{pedidos_pendientes}")],
  },
  {
    nombre: "admin_ventas_hoy",
    descripcion: "El equipo pregunta por las ventas del día (solo admin)",
    palabras_clave: ["ventas de hoy", "ventas del dia", "ventas hoy", "cuanto se ha vendido", "cuanto vendimos"],
    respuestas: [texto("{ventas_hoy}")],
  },
  {
    nombre: "metodos_pago",
    descripcion: "Pregunta cómo puede pagar",
    palabras_clave: ["pagar", "pago", "metodos de pago", "formas de pago", "tarjeta", "efectivo", "transferencia"],
    respuestas: [
      texto("Aceptamos pagos en efectivo, con tarjeta y por transferencia."),
      texto("Puedes pagar como te quede más cómodo: en efectivo, con tarjeta o por transferencia."),
    ],
    sugerencias: ["Ver el menú", "¿Cómo hago un pedido?"],
  },
  {
    nombre: "horario",
    descripcion: "Pregunta por el horario de atención",
    palabras_clave: ["horario", "hora abren", "a que hora", "abierto", "abren", "cierran", "atienden"],
    respuestas: [
      texto("Nuestro horario es de lunes a viernes de 8:00 a 18:00, y sábados y domingos de 9:00 a 17:00. ¡Te esperamos!"),
      texto("Abrimos de lunes a viernes de 8:00 a 18:00. Los sábados y domingos, de 9:00 a 17:00."),
    ],
    sugerencias: ["Quiero hacer una reserva", "¿Dónde quedan?"],
  },
  {
    nombre: "ubicacion",
    descripcion: "Pregunta dónde queda el local",
    palabras_clave: ["direccion", "ubicacion", "donde quedan", "donde estan", "como llegar", "donde queda"],
    respuestas: [
      texto("Nos encontramos en Calle del Sabor 123, Ciudad del Brunch. En la página de inicio tienes el mapa para llegar."),
    ],
    sugerencias: ["¿Cuál es el horario?", "Quiero hacer una reserva"],
  },
  {
    nombre: "agradecimiento",
    descripcion: "El usuario agradece",
    palabras_clave: ["gracias", "muchas gracias", "te agradezco"],
    respuestas: [
      texto("¡Con gusto! ¿Te ayudo con algo más?"),
      texto("¡A ti! Aquí sigo si necesitas algo más."),
      texto("¡Para eso estoy! Si se te ocurre otra cosa, me escribes."),
    ],
  },
  {
    nombre: "despedida",
    descripcion: "El usuario se despide",
    palabras_clave: ["adios", "chao", "hasta luego", "nos vemos"],
    respuestas: [
      texto("¡Hasta pronto, {nombre}! Que disfrutes tu brunch."),
      texto("¡Chao, {nombre}! Te esperamos pronto por aquí."),
      texto("¡Nos vemos, {nombre}! Que tengas un día delicioso."),
    ],
  },
  {
    nombre: "como_estas",
    descripcion: "Charla corta: pregunta cómo está el asistente",
    palabras_clave: ["como estas", "que tal", "como te va", "como va todo", "todo bien"],
    respuestas: [
      texto("¡Muy bien, gracias por preguntar! Con el horno prendido y listo para ayudarte. ¿Qué necesitas?"),
      texto("¡Todo bien por aquí! ¿En qué te ayudo hoy?"),
      texto("¡De maravilla! Cuéntame, ¿qué se te antoja?"),
    ],
    sugerencias: ["Ver el menú", "Quiero hacer una reserva"],
  },
  {
    nombre: "ayuda",
    descripcion: "Pregunta qué puede hacer el asistente o quién es",
    palabras_clave: ["ayuda", "ayudame", "que puedes hacer", "que sabes hacer", "en que me ayudas", "opciones", "quien eres", "eres un robot", "eres una persona"],
    respuestas: [
      texto("Soy el asistente virtual de Brunch & Co. Te muestro el menú, te cuento cómo va tu pedido, te ayudo a reservar, cambiar o cancelar una mesa, y te digo el horario, la dirección y cómo pagar."),
      texto("Puedo ayudarte con el menú y los precios, tus pedidos, tus reservas, el horario, la dirección y los métodos de pago. ¿Por dónde empezamos?"),
    ],
    sugerencias: ["Ver el menú", "Quiero hacer una reserva", "¿Cómo va mi pedido?", "¿Cuál es el horario?"],
  },
  {
    nombre: "recomendacion",
    descripcion: "Pide una recomendación de la carta",
    palabras_clave: ["que me recomiendas", "recomiendas", "recomiendame", "recomendacion", "recomendado", "que pido", "lo mas rico", "lo mas pedido"],
    respuestas: [
      texto("Hoy te recomendaría {recomendacion}. Si quieres ver todo lo que hay, escribe \"menú\"."),
      texto("Si me dejas elegir: {recomendacion}. ¿Te muestro la carta completa?"),
      texto("Una buena opción es {recomendacion}. También puedo mostrarte el menú completo."),
    ],
    sugerencias: ["Ver el menú", "¿Cómo hago un pedido?"],
  },
  {
    nombre: "desconocida",
    descripcion: "Respuesta cuando ninguna otra intención coincide",
    palabras_clave: [],
    respuestas: [
      texto("¡Ups! No entendí bien. Puedo ayudarte con el menú, tus pedidos, tus reservas o los métodos de pago."),
      texto("Perdona, esa no la entendí. ¿Me lo dices de otra forma? También puedes elegir una de estas opciones."),
      texto("Mmm, no estoy seguro de haberte entendido. Prueba con una de estas opciones o escríbelo con otras palabras."),
    ],
    sugerencias: ["Ver el menú", "Quiero hacer una reserva", "¿Cuál es el horario?", "¿Qué métodos de pago aceptan?"],
  },
];
