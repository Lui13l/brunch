const { ChatIntent, MenuItem, Order, Reservation, Comanda } = require("../models");
const { diaCalendarioHoy, hoyLocal, rangoLocal } = require("../utils/tiempo");
const { ROL } = require("../utils/roles");
const { PREGUNTAS_SEGURAS, PREGUNTAS_DUDOSAS, RELLENO, FAMILIAS, NOMBRE_FAMILIA, SINONIMOS } = require("../data/carta");

// Intención que se usa cuando ninguna otra coincide.
const INTENCION_DESCONOCIDA = "desconocida";
// No está en la base: es la respuesta que sale de buscar en la carta.
const INTENCION_PRODUCTO = "consulta_producto";
const RESPUESTA_POR_DEFECTO =
  "¡Ups! No entendí bien. Puedo ayudarte con el menú, tus pedidos o tus reservas.";
const SOLO_EQUIPO = "Esa información es solo para el equipo del restaurante.";
// Lo que se ofrece cuando no se entendió el mensaje y la intención no trae sugerencias.
const SUGERENCIAS_BASE = ["Ver el menú", "Quiero hacer una reserva", "¿Cuál es el horario?"];
const MAX_SUGERENCIAS = 4;

// Charla: saludos, gracias y despedidas. Si el mensaje trae además una
// pregunta de verdad ("hola, ¿qué hay en el menú?"), gana la pregunta.
const CHARLA = new Set(["saludo", "como_estas", "agradecimiento", "despedida"]);

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
//
// Devuelve la intención y si el mensaje, además de preguntar algo, saludó:
// en ese caso la respuesta devuelve el saludo antes de contestar.
const analizar = async (mensaje) => {
  const texto = palabras(mensaje);
  const intenciones = await ChatIntent.find({ activa: true });

  // Se lleva la mejor consulta y la mejor charla por separado.
  const mejor = { consulta: null, charla: null };
  const puntos = { consulta: 0, charla: 0 };
  let saludo = false;

  for (const intencion of intenciones) {
    const puntaje = intencion.palabras_clave.reduce((suma, clave) => suma + puntajeDeClave(texto, palabras(clave)), 0);
    if (puntaje === 0) continue;
    if (intencion.nombre === "saludo") saludo = true;

    const grupo = CHARLA.has(intencion.nombre) ? "charla" : "consulta";
    if (puntaje > puntos[grupo]) {
      mejor[grupo] = intencion;
      puntos[grupo] = puntaje;
    }
  }

  return {
    intencion: mejor.consulta || mejor.charla || intenciones.find((i) => i.nombre === INTENCION_DESCONOCIDA) || null,
    saludo: saludo && Boolean(mejor.consulta),
    // Saludó, pregunte o no algo más: una respuesta sacada de la carta también
    // devuelve el saludo.
    saludoDicho: saludo,
  };
};

const detectarIntencion = async (mensaje) => (await analizar(mensaje)).intencion;

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

  // Un plato cualquiera de la carta de la web, para "¿qué me recomiendas?".
  recomendacion: async () => {
    const [plato] = await MenuItem.aggregate([
      { $match: { activo: true, visible_web: { $ne: false } } },
      { $sample: { size: 1 } },
    ]);
    return plato ? `${plato.nombre} (${formatearPrecio(plato.precio)})` : "algo de nuestra carta";
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

// --- Preguntas sobre la carta ------------------------------------------------
// "¿Venden cerveza?", "¿cuánto cuesta el latte?", "un café porfa". En vez de
// responder "no entendí", se busca en la carta: si está, se dice con su
// precio; si hay algo parecido, se ofrece; si no, se avisa que no se vende.

const MAX_PLATOS = 6;

const FAMILIA_DE = new Map(
  Object.entries(FAMILIAS).flatMap(([tipo, lista]) => lista.map((palabra) => [palabra, tipo]))
);

// Dónde termina, dentro del mensaje, la primera pregunta de la lista
// ("cuanto cuesta" antes que "cuanto"). -1 si no hay ninguna.
const finDePregunta = (normales, preguntas) => {
  let mejor = { inicio: Infinity, fin: -1 };
  for (const pregunta of preguntas) {
    const partes = pregunta.split(" ");
    for (let i = 0; i + partes.length <= normales.length; i += 1) {
      if (!partes.every((parte, k) => normales[i + k] === parte)) continue;
      const fin = i + partes.length;
      if (i < mejor.inicio || (i === mejor.inicio && fin > mejor.fin)) mejor = { inicio: i, fin };
      break;
    }
  }
  return mejor.fin;
};

// Las formas en que puede estar escrita una palabra en la carta. `raiz` le
// quita "es" a "cafes" y deja "caf", que ya no se parece a "café": por eso se
// prueba también quitando solo la "s".
const formasDe = (palabra) => [
  ...new Set([raiz(palabra), palabra.length > 3 && palabra.endsWith("s") ? palabra.slice(0, -1) : palabra]),
];

// Qué se está buscando en el mensaje y con cuánta certeza es una pregunta
// sobre algo que se vende.
const loBuscado = (mensaje) => {
  // Las palabras tal como se escribieron (para repetirlas en la respuesta) y
  // normalizadas (para comparar).
  const escritas = String(mensaje).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const normales = escritas.map((palabra) => normalizar(palabra));

  const finSegura = finDePregunta(normales, PREGUNTAS_SEGURAS);
  const finDudosa = finSegura < 0 ? finDePregunta(normales, PREGUNTAS_DUDOSAS) : -1;
  const desde = Math.max(finSegura, finDudosa, 0);

  const utiles = (inicio, fin) => {
    const terminos = [];
    for (let i = inicio; i < fin; i += 1) {
      if (normales[i].length < 2 || RELLENO.has(normales[i])) continue;
      terminos.push({ escrita: escritas[i], formas: formasDe(normales[i]) });
    }
    return terminos;
  };
  // Lo buscado suele ir después de la pregunta ("venden cerveza"); si ahí no
  // hay nada, va antes ("¿qué bebidas tienen?").
  const despues = utiles(desde, normales.length);
  const terminos = despues.length > 0 ? despues : utiles(0, desde);
  return { terminos, segura: finSegura >= 0, conPregunta: finSegura >= 0 || finDudosa >= 0 };
};

// ¿El término nombra alguna de estas palabras? Cuenta también su sinónimo en
// inglés, porque la carta mezcla los dos idiomas.
const nombra = (termino, palabrasDelPlato) =>
  termino.formas
    .flatMap((forma) => [forma, ...(SINONIMOS[forma] ?? [])])
    .some((buscada) => palabrasDelPlato.some((palabra) => parecido(buscada, palabra) > 0 || parecido(palabra, buscada) > 0));

const enLista = (platos) => platos.slice(0, MAX_PLATOS).map((p) => `- ${p.nombre}: ${formatearPrecio(p.precio)}`).join("\n");
const enLinea = (platos) => platos.slice(0, 4).map((p) => `${p.nombre} (${formatearPrecio(p.precio)})`).join(", ");

/**
 * Responde una pregunta sobre un producto buscándolo en la carta de la web.
 * Devuelve null si el mensaje no parece hablar de un producto: ahí sigue el
 * camino normal de las intenciones.
 *
 * @param tema Nombre de la intención que ya activó el mensaje, o null si no
 *   activó ninguna (o solo charla). Con un tema, aquí solo se responde si de
 *   verdad se preguntó por un plato de la carta ("precio del latte" no debe
 *   soltar el menú entero), y nunca para decir que algo no se vende
 *   ("¿tienen mesa para hoy?" es una reserva).
 */
const consultarCarta = async (mensaje, { tema }) => {
  const { terminos, segura, conPregunta } = loBuscado(mensaje);
  if (terminos.length === 0 || terminos.length > 5) return null;
  // Sin pregunta ("un latte porfa", "cerveza?") solo vale un mensaje corto: en
  // una frase larga, nombrar un plato no es preguntar por él.
  if (!conPregunta && terminos.length > 2) return null;
  // "¿Cómo va mi pedido de pancakes?" es sobre el pedido, no sobre la carta.
  if (tema && !conPregunta && tema !== "menu") return null;

  const carta = await MenuItem.find({ activo: true, visible_web: { $ne: false } })
    .populate("categoria_id", "nombre")
    .sort({ orden: 1, nombre: 1 })
    .lean();
  const platos = carta.map((p) => ({
    nombre: p.nombre,
    precio: p.precio,
    tipo: p.tipo,
    categoria: p.categoria_id?.nombre ?? null,
    palabras: palabras(p.nombre),
  }));

  // Por nombre: primero los que traen todo lo pedido, después los que traen parte.
  const aciertos = platos
    .map((plato) => ({ plato, cuantos: terminos.filter((t) => nombra(t, plato.palabras)).length }))
    .filter((a) => a.cuantos > 0);
  const completos = aciertos.filter((a) => a.cuantos === terminos.length).map((a) => a.plato);
  const pedido = terminos.map((t) => t.escrita).join(" ");
  const SI_HAY = ["¿Cómo hago un pedido?", "Ver el menú"];

  if (completos.length > 0) {
    const respuesta =
      completos.length === 1
        ? `¡Sí! Tenemos ${completos[0].nombre} a ${formatearPrecio(completos[0].precio)}.`
        : `¡Sí! Esto es lo que tenemos:\n${enLista(completos)}`;
    return { respuesta, sugerencias: SI_HAY };
  }
  if (aciertos.length > 0) {
    const parecidos = aciertos.sort((a, b) => b.cuantos - a.cuantos).map((a) => a.plato);
    return {
      respuesta: `No tenemos exactamente «${pedido}», pero esto se le parece:\n${enLista(parecidos)}`,
      sugerencias: SI_HAY,
    };
  }

  // Una sección entera: "¿tienen postres?", "¿qué bebidas hay?".
  const seccion = platos.filter((plato) =>
    terminos.some((t) => t.formas.includes(normalizar(plato.tipo ?? "")) || (plato.categoria && nombra(t, palabras(plato.categoria))))
  );
  if (seccion.length > 0) {
    return { respuesta: `¡Claro! Esto es lo que tenemos:\n${enLista(seccion)}`, sugerencias: SI_HAY };
  }

  // No está en la carta. Solo se afirma que no se vende si la pregunta era
  // claramente de venta o lo buscado es una comida o bebida conocida.
  if (tema) return null;
  const familia = terminos.flatMap((t) => t.formas.map((forma) => FAMILIA_DE.get(forma))).find(Boolean);
  if (!segura && !familia) return null;

  const deLaFamilia = familia ? platos.filter((plato) => plato.tipo === familia) : [];
  const alternativa =
    deLaFamilia.length > 0
      ? ` En ${NOMBRE_FAMILIA[familia]} tenemos ${enLinea(deLaFamilia)}${deLaFamilia.length > 4 ? " y más" : ""}.`
      : " Si quieres, te muestro lo que sí tenemos.";
  return {
    respuesta: `Por ahora no vendemos ${pedido}.${alternativa}`,
    sugerencias: ["Ver el menú", "¿Qué me recomiendas?"],
  };
};

// Las opciones en orden al azar, para que el bot no suene repetitivo.
const barajar = (lista) => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

// Las respuestas dicen entre comillas « » lo que se puede contestar ("dime
// «sí» o «no»"). Eso mismo se ofrece como botones: «sí» -> "Sí".
const respuestasRapidas = (texto) => {
  const opciones = [...String(texto ?? "").matchAll(/«([^»]{1,30})»/g)].map(
    ([, opcion]) => opcion.charAt(0).toUpperCase() + opcion.slice(1)
  );
  return [...new Set(opciones)].slice(0, MAX_SUGERENCIAS);
};

/**
 * Responde un mensaje con una de las respuestas de su intención.
 *
 * - `evitar`: lo último que dijo el bot. Si la intención tiene más de una
 *   respuesta, no repite esa.
 * - Si el mensaje saluda y además pregunta algo, devuelve el saludo primero.
 * - `sugerencias`: qué ofrecer como botones después: las de la intención o,
 *   si no tiene, lo que la misma respuesta pide contestar entre « ».
 * - Si pregunta por un producto, se busca en la carta antes de rendirse con
 *   un "no entendí" (ver consultarCarta).
 */
const responder = async (mensaje, usuario, { evitar } = {}) => {
  const { intencion, saludo, saludoDicho } = await analizar(mensaje);
  const conSaludo = (texto, saludar = saludo) =>
    saludar && !/^¡?hola/i.test(texto) ? `¡Hola${usuario?.nombre ? `, ${usuario.nombre}` : ""}! ${texto}` : texto;

  const sinTema = !intencion || intencion.nombre === INTENCION_DESCONOCIDA || CHARLA.has(intencion.nombre);
  const deLaCarta = await consultarCarta(mensaje, { tema: sinTema ? null : intencion.nombre });
  if (deLaCarta) {
    return { intencion: INTENCION_PRODUCTO, respuesta: conSaludo(deLaCarta.respuesta, saludoDicho), sugerencias: deLaCarta.sugerencias };
  }

  const opciones = intencion?.respuestas || [];

  if (opciones.length === 0) {
    return {
      intencion: intencion?.nombre || INTENCION_DESCONOCIDA,
      respuesta: RESPUESTA_POR_DEFECTO,
      sugerencias: SUGERENCIAS_BASE,
    };
  }

  const yaDicho = evitar?.trim();
  let respuesta = "";
  for (const opcion of barajar(opciones)) {
    respuesta = conSaludo((await rellenarVariables(opcion.respuesta, usuario)).trim());
    if (respuesta !== yaDicho) break;
  }

  const propias = intencion.sugerencias ?? [];
  return {
    intencion: intencion.nombre,
    respuesta,
    sugerencias: (propias.length > 0 ? propias : respuestasRapidas(respuesta)).slice(0, MAX_SUGERENCIAS),
  };
};

module.exports = { normalizar, detectarIntencion, responder, respuestasRapidas };
