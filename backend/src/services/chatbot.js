const { ChatIntent, MenuItem, Order, Reservation } = require("../models");

// Intención que se usa cuando ninguna otra coincide.
const INTENCION_DESCONOCIDA = "desconocida";
const RESPUESTA_POR_DEFECTO =
  "Lo siento, no entendí tu mensaje. Puedes preguntarme por el menú, tus pedidos o tus reservas.";

const ESTADOS_PEDIDO = {
  pendiente: "pendiente de confirmación",
  confirmado: "confirmado",
  preparando: "en preparación",
  en_camino: "en camino",
  entregado: "entregado",
  cancelado: "cancelado",
};

// Minúsculas, sin tildes y sin signos: "¿Qué hay en el MENÚ?" -> "que hay en el menu"
const normalizar = (texto) =>
  String(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const formatearPrecio = (valor) => `$${valor.toLocaleString("es-CO")}`;

// Puntúa cada intención por las palabras clave que aparecen en el mensaje.
// Las frases largas pesan más ("estado de mi pedido" gana a "pedido").
const detectarIntencion = async (mensaje) => {
  const texto = ` ${normalizar(mensaje)} `;
  const intenciones = await ChatIntent.find({ activa: true });

  let mejor = null;
  let mejorPuntaje = 0;

  for (const intencion of intenciones) {
    const puntaje = intencion.palabras_clave
      .map(normalizar)
      .filter((clave) => clave && texto.includes(` ${clave} `))
      .reduce((suma, clave) => suma + clave.split(" ").length, 0);

    if (puntaje > mejorPuntaje) {
      mejor = intencion;
      mejorPuntaje = puntaje;
    }
  }

  return mejor || intenciones.find((i) => i.nombre === INTENCION_DESCONOCIDA) || null;
};

const VARIABLES = {
  nombre: async (usuario) => usuario.nombre,

  menu: async () => {
    const productos = await MenuItem.find({ activo: true })
      .populate("categoria_id", "nombre orden")
      .sort({ orden: 1, nombre: 1 });
    if (productos.length === 0) return "Por ahora no hay productos disponibles.";

    const porCategoria = new Map();
    for (const p of productos) {
      const categoria = p.categoria_id?.nombre || "Otros";
      if (!porCategoria.has(categoria)) {
        porCategoria.set(categoria, { orden: p.categoria_id?.orden ?? Infinity, lineas: [] });
      }
      porCategoria.get(categoria).lineas.push(`- ${p.nombre}: ${formatearPrecio(p.precio)}`);
    }

    const secciones = [...porCategoria]
      .sort(([, a], [, b]) => a.orden - b.orden)
      .map(([categoria, { lineas }]) => `${categoria}:\n${lineas.join("\n")}`);
    return `Este es nuestro menú:\n\n${secciones.join("\n\n")}`;
  },

  ultimo_pedido: async (usuario) => {
    if (!usuario) return "Inicia sesión para que pueda consultar tus pedidos.";
    const pedido = await Order.findOne({ usuario_id: usuario._id }).sort({ createdAt: -1 });
    if (!pedido) return "Todavía no tienes pedidos.";

    const productos = pedido.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(", ");
    return `Tu último pedido (${productos}) por ${formatearPrecio(pedido.total)} está ${ESTADOS_PEDIDO[pedido.estado]}.`;
  },

  mis_reservas: async (usuario) => {
    if (!usuario) return "Inicia sesión para que pueda consultar tus reservas.";
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
    const reservas = await Reservation.find({
      usuario_id: usuario._id,
      dia: { $gte: hoy },
      estado_reserva: { $in: ["pendiente", "confirmada"] },
    }).sort({ dia: 1, hora: 1 });
    if (reservas.length === 0) return "No tienes reservas próximas.";

    const lineas = reservas.map(
      (r) => `- ${r.dia.toISOString().slice(0, 10)} a las ${r.hora} para ${r.cupo} persona(s) (${r.estado_reserva})`
    );
    return `Tus próximas reservas:\n${lineas.join("\n")}`;
  },
};

// Reemplaza solo las variables que aparecen en el texto, para no consultar
// la base de datos de más. "usuario" es null cuando escribe un visitante.
const rellenarVariables = async (plantilla, usuario) => {
  // Sin sesión no hay nombre: "¡Hola {nombre}!" -> "¡Hola!", "Adiós, {nombre}." -> "Adiós."
  let texto = usuario ? plantilla : plantilla.replace(/,?\s*\{nombre\}/g, "");
  for (const [nombre, obtener] of Object.entries(VARIABLES)) {
    const marcador = `{${nombre}}`;
    if (texto.includes(marcador)) texto = texto.split(marcador).join(await obtener(usuario));
  }
  return texto;
};

// Elige una de las respuestas de la intención al azar para que el bot no suene repetitivo.
const responder = async (mensaje, usuario) => {
  const intencion = await detectarIntencion(mensaje);
  const opciones = intencion?.respuestas || [];

  if (opciones.length === 0) {
    return { intencion: intencion?.nombre || INTENCION_DESCONOCIDA, respuesta: RESPUESTA_POR_DEFECTO };
  }

  const elegida = opciones[Math.floor(Math.random() * opciones.length)];
  return {
    intencion: intencion.nombre,
    respuesta: await rellenarVariables(elegida.respuesta, usuario),
  };
};

module.exports = { normalizar, detectarIntencion, responder, INTENCION_DESCONOCIDA };
