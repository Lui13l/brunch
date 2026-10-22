// Intenciones iniciales del chatbot que carga "npm run seed".
// Las respuestas pueden usar {nombre}, {menu}, {ultimo_pedido} y {mis_reservas}.
// Se pueden editar después desde /api/chat/intenciones sin tocar código.
const texto = (respuesta) => ({ tipo: "texto", respuesta });

module.exports = [
  {
    nombre: "saludo",
    descripcion: "El usuario saluda",
    palabras_clave: ["hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "hey"],
    respuestas: [
      texto("¡Hola {nombre}! Soy el asistente de Brunch. Puedo mostrarte el menú, contarte cómo va tu pedido o revisar tus reservas."),
      texto("¡Hola {nombre}! ¿En qué te ayudo? Pregúntame por el menú, tus pedidos o tus reservas."),
    ],
  },
  {
    nombre: "menu",
    descripcion: "Pregunta por la carta o los precios",
    palabras_clave: ["menu", "carta", "que tienen", "que hay", "productos", "platos", "comida", "bebidas", "precios", "precio"],
    respuestas: [texto("{menu}")],
  },
  {
    nombre: "hacer_pedido",
    descripcion: "Quiere saber cómo pedir",
    palabras_clave: ["hacer un pedido", "quiero pedir", "como pido", "pedir", "ordenar"],
    respuestas: [
      texto("Para hacer un pedido elige tus productos en el menú de la página e indica la dirección de entrega. Si quieres ver lo que tenemos, escribe \"menú\"."),
    ],
  },
  {
    nombre: "estado_pedido",
    descripcion: "Pregunta por su último pedido",
    palabras_clave: ["pedido", "mi pedido", "estado de mi pedido", "donde esta mi pedido", "orden", "domicilio"],
    respuestas: [texto("{ultimo_pedido}")],
  },
  {
    nombre: "hacer_reserva",
    descripcion: "Quiere reservar una mesa",
    palabras_clave: ["reservar", "quiero reservar", "hacer una reserva", "mesa", "reservacion"],
    respuestas: [
      texto("Puedes reservar desde la sección de reservas indicando el día, la hora y el número de personas. Te avisaremos cuando quede confirmada."),
    ],
  },
  {
    nombre: "mis_reservas",
    descripcion: "Pregunta por sus reservas",
    palabras_clave: ["mis reservas", "mi reserva", "reservas", "tengo reserva"],
    respuestas: [texto("{mis_reservas}")],
  },
  {
    nombre: "metodos_pago",
    descripcion: "Pregunta cómo puede pagar",
    palabras_clave: ["pagar", "pago", "metodos de pago", "formas de pago", "tarjeta", "efectivo", "transferencia"],
    respuestas: [texto("Aceptamos pagos en efectivo, con tarjeta y por transferencia.")],
  },
  {
    nombre: "agradecimiento",
    descripcion: "El usuario agradece",
    palabras_clave: ["gracias", "muchas gracias", "te agradezco"],
    respuestas: [texto("¡Con gusto! ¿Te ayudo con algo más?")],
  },
  {
    nombre: "despedida",
    descripcion: "El usuario se despide",
    palabras_clave: ["adios", "chao", "hasta luego", "nos vemos"],
    respuestas: [texto("¡Hasta pronto, {nombre}! Que disfrutes tu brunch.")],
  },
  {
    nombre: "desconocida",
    descripcion: "Respuesta cuando ninguna otra intención coincide",
    palabras_clave: [],
    respuestas: [
      texto("Lo siento, no entendí tu mensaje. Puedes preguntarme por el menú, tus pedidos, tus reservas o los métodos de pago."),
    ],
  },
];
