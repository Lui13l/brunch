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
      texto("¡Hola {nombre}! Soy el asistente de Brunch & Co. Estoy aquí para ayudarte con el menú, tus pedidos o tus reservas."),
      texto("¡Hola {nombre}! ¿Qué necesitas? Puedo ayudarte con el menú, tus pedidos o tus reservas."),
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
    nombre: "crear_reserva",
    descripcion: "Quiere agendar una reserva desde el chatbot",
    palabras_clave: ["reservar una mesa", "quiero reservar", "hacer una reserva", "agendar una reserva", "reservar"],
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
  },
  {
    nombre: "metodos_pago",
    descripcion: "Pregunta cómo puede pagar",
    palabras_clave: ["pagar", "pago", "metodos de pago", "formas de pago", "tarjeta", "efectivo", "transferencia"],
    respuestas: [texto("Aceptamos pagos en efectivo, con tarjeta y por transferencia.")],
  },
  {
    nombre: "horario",
    descripcion: "Pregunta por el horario de atención",
    palabras_clave: ["horario", "hora abren", "a que hora", "abierto", "abren", "cierran", "atienden"],
    respuestas: [
      texto("Nuestro horario es de lunes a viernes de 8:00 a 18:00, y sábados y domingos de 9:00 a 17:00. ¡Te esperamos!"),
    ],
  },
  {
    nombre: "ubicacion",
    descripcion: "Pregunta dónde queda el local",
    palabras_clave: ["direccion", "ubicacion", "donde quedan", "donde estan", "como llegar", "donde queda"],
    respuestas: [
      texto("Nos encontramos en Calle del Sabor 123, Ciudad del Brunch. En la página de inicio tienes el mapa para llegar."),
    ],
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
      texto("¡Ups! No entendí bien. Puedo ayudarte con el menú, tus pedidos, tus reservas o los métodos de pago."),
    ],
  },
];
