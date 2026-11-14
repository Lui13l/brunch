const { ChatIntent, MenuItem, Order, Reservation, Comanda } = require("../models");
const { diaCalendarioHoy, hoyLocal, rangoLocal } = require("../utils/tiempo");
const { ROL } = require("../utils/roles");

// Intención que se usa cuando ninguna otra coincide.
const INTENCION_DESCONOCIDA = "desconocida";
const RESPUESTA_POR_DEFECTO =
  "¡Ups! No entendí bien. Puedo ayudarte con el menú, tus pedidos o tus reservas.";
const SOLO_EQUIPO = "Esa información es solo para el equipo del restaurante.";

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
const formatearPersonas = (cantidad) => `${cantidad} ${cantidad === 1 ? "persona" : "personas"}`;

// --- Comparación de palabras -------------------------------------------------
// La gente escribe "reservas", "resevar" o "menu porfa". Para entenderla se
// compara palabra por palabra: sin el plural y tolerando un error de dedo.

// "reservas" -> "reserva", "reservaciones" -> "reservacion". No pretende ser
// gramática: basta con que el mensaje y la palabra clave pasen por lo mismo.
const raiz = (palabra) => {
  if (palabra.length > 4 && /[^aeiou]es$/.test(palabra)) return palabra.slice(0, -2);
  if (palabra.length > 3 && palabra.endsWith("s")) return palabra.slice(0, -1);
  return palabra;
};

const palabras = (texto) => normalizar(texto).split(" ").filter(Boolean).map(raiz);

// Cuántas letras hay que cambiar, quitar o poner para pasar de a hasta b.
const distancia = (a, b) => {
  let fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const nueva = [i];
    for (let j = 1; j <= b.length; j += 1) {
      nueva[j] = Math.min(fila[j] + 1, nueva[j - 1] + 1, fila[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    fila = nueva;
  }
  return fila[b.length];
};

// Errores permitidos según el largo de la palabra clave. Las cortas ("mesa",
// "pago") deben coincidir exactas: con una letra de diferencia ya son otra palabra.
const tolerancia = (clave) => (clave.length >= 8 ? 2 : clave.length >= 5 ? 1 : 0);

// 2 = igual, 1 = parecida (error de escritura), 0 = distinta.
const parecido = (palabra, clave) => {
  if (palabra === clave) return 2;
  const permitido = tolerancia(clave);
  if (permitido === 0 || palabra[0] !== clave[0] || Math.abs(palabra.length - clave.length) > permitido) return 0;
  return distancia(palabra, clave) <= permitido ? 1 : 0;
};

// Busca las palabras de la clave seguidas dentro del mensaje. Devuelve 0 si no
// están; si están, las palabras de la clave más un poco por cada una exacta,
// para que una coincidencia exacta le gane a una aproximada del mismo largo.
const puntajeDeClave = (mensaje, clave) => {
  if (clave.length === 0 || clave.length > mensaje.length) return 0;
  let mejor = 0;
  for (let inicio = 0; inicio + clave.length <= mensaje.length; inicio += 1) {
    let exactas = 0;
    let coincide = true;
    for (let k = 0; k < clave.length && coincide; k += 1) {
      const nivel = parecido(mensaje[inicio + k], clave[k]);
      if (nivel === 0) coincide = false;
      else if (nivel === 2) exactas += 1;
    }
    if (coincide) mejor = Math.max(mejor, clave.length + exactas * 0.1);
  }
  return mejor;
};

// Puntúa cada intención por las palabras clave que aparecen en el mensaje.
// Las frases largas pesan más ("estado de mi pedido" gana a "pedido").
const detectarIntencion = async (mensaje) => {
  const texto = palabras(mensaje);
  const intenciones = await ChatIntent.find({ activa: true });

  let mejor = null;
  let mejorPuntaje = 0;

  for (const intencion of intenciones) {
    const puntaje = intencion.palabras_clave.reduce((suma, clave) => suma + puntajeDeClave(texto, palabras(clave)), 0);

    if (puntaje > mejorPuntaje) {
      mejor = intencion;
      mejorPuntaje = puntaje;
    }
  }

  return mejor || intenciones.find((i) => i.nombre === INTENCION_DESCONOCIDA) || null;
};

const esAdmin = (usuario) => usuario?.rol_id === ROL.ADMIN;

const VARIABLES = {
  nombre: async (usuario) => usuario.nombre,

  menu: async () => {
    const productos = await MenuItem.find({ activo: true, visible_web: { $ne: false } })
      .populate("categoria_id", "nombre orden")
      .sort({ orden: 1, nombre: 1 });
    if (productos.length === 0) return "Por ahora no tenemos productos disponibles. Puedes volver a consultar más tarde.";

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
    if (!usuario) return "Para revisar tus pedidos, inicia sesión y con gusto te ayudo.";
    const pedido = await Order.findOne({ usuario_id: usuario._id }).sort({ createdAt: -1 });
    if (!pedido) return "Aún no tienes pedidos. Cuando hagas uno, puedo ayudarte a revisar cómo va.";

    const productos = pedido.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(", ");
    return `Tu último pedido (${productos}) por ${formatearPrecio(pedido.total)} está ${ESTADOS_PEDIDO[pedido.estado]}.`;
  },

  mis_reservas: async (usuario) => {
    if (!usuario) return "Para revisar tus reservas, inicia sesión y con gusto te ayudo.";
    const reservas = await Reservation.find({
      usuario_id: usuario._id,
      dia: { $gte: diaCalendarioHoy() },
      estado_reserva: { $in: ["pendiente", "confirmada"] },
    }).sort({ dia: 1, hora: 1 });
    if (reservas.length === 0) return "No veo reservas próximas a tu nombre. Si quieres, puedo ayudarte a agendar una.";

    const lineas = reservas.map(
      (r) => `- ${r.dia.toISOString().slice(0, 10)} a las ${r.hora}, para ${formatearPersonas(r.cupo)} (${r.estado_reserva})`
    );
    return `¡Estas son tus próximas reservas!\n${lineas.join("\n")}`;
  },

  // --- Consultas del negocio: solo para un admin con sesión ---
  // Quien no es admin nunca ve datos de otras personas: recibe los suyos o
  // un aviso de que esa información no es para clientes.

  reservas_hoy: async (usuario) => {
    if (!esAdmin(usuario)) return VARIABLES.mis_reservas(usuario);
    const reservas = await Reservation.find({
      dia: diaCalendarioHoy(),
      estado_reserva: { $in: ["pendiente", "confirmada"] },
    })
      .populate("usuario_id", "nombre")
      .sort({ hora: 1 });
    if (reservas.length === 0) return "Hoy no hay reservas pendientes ni confirmadas.";

    const total = reservas.reduce((suma, r) => suma + r.cupo, 0);
    const lineas = reservas.map(
      (r) => `- ${r.hora}, ${formatearPersonas(r.cupo)}, ${r.usuario_id?.nombre ?? "cliente"} (${r.estado_reserva})`
    );
    return `Hoy hay ${reservas.length} ${reservas.length === 1 ? "reserva" : "reservas"} para ${formatearPersonas(total)}:\n${lineas.join("\n")}`;
  },

  pedidos_pendientes: async (usuario) => {
    if (!esAdmin(usuario)) return VARIABLES.ultimo_pedido(usuario);
    const pedidos = await Order.find({ estado: { $in: Order.ACTIVOS } }).select("estado").lean();
    if (pedidos.length === 0) return "No hay pedidos web activos en este momento.";

    const lineas = Order.ACTIVOS.map((estado) => [estado, pedidos.filter((p) => p.estado === estado).length])
      .filter(([, cuantos]) => cuantos > 0)
      .map(([estado, cuantos]) => `- ${cuantos} ${ESTADOS_PEDIDO[estado]}`);
    return `Hay ${pedidos.length} ${pedidos.length === 1 ? "pedido web activo" : "pedidos web activos"}:\n${lineas.join("\n")}`;
  },

  ventas_hoy: async (usuario) => {
    if (!esAdmin(usuario)) return SOLO_EQUIPO;
    const { inicio, fin } = rangoLocal(hoyLocal(), hoyLocal());
    const cuentas = await Comanda.find({ estado: "CERRADA", fecha_cierre: { $gte: inicio, $lt: fin } })
      .select("total")
      .lean();
    if (cuentas.length === 0) return "Hoy todavía no se ha cobrado ninguna cuenta en el salón.";

    const total = cuentas.reduce((suma, c) => suma + Number(c.total ?? 0), 0);
    return `Hoy se han cobrado ${cuentas.length} ${cuentas.length === 1 ? "cuenta" : "cuentas"} en el salón por ${formatearPrecio(total)}.`;
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

module.exports = { normalizar, detectarIntencion, responder };
