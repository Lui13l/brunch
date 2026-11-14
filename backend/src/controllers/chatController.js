const { ChatConversation, ChatIntent, Reservation } = require("../models");
const { HttpError, pick } = require("../utils/http");
const { esAdmin, verificarDueno } = require("../middleware/auth");
const chatbot = require("../services/chatbot");
const { hoyLocal, sumarDias, parseFecha, diaCalendarioHoy } = require("../utils/tiempo");
const { errorHorarioReserva } = require("../utils/horarioReservas");
const {
  MAX_PERSONAS_POR_HORARIO,
  consultarDisponibilidad,
  crearConCapacidad,
  cancelarPropia,
  actualizarConCapacidad,
} = require("../services/reservas");

const MAX_LARGO_MENSAJE = 500;
const CLAVE_RESERVA_CHAT = "reserva_chat";
const CLAVE_CANCELACION_CHAT = "reserva_cancelacion";
const CLAVE_EDICION_CHAT = "reserva_edicion";

const personas = (cantidad) => `${cantidad} ${cantidad === 1 ? "persona" : "personas"}`;

const extraerFecha = (mensaje) => {
  const texto = chatbot.normalizar(mensaje);
  const hoy = hoyLocal();
  if (/\bhoy\b/.test(texto)) return hoy;
  if (/\bpasado manana\b/.test(texto)) return sumarDias(hoy, 2);
  if (/\bmanana\b/.test(texto)) return sumarDias(hoy, 1);

  const coincidencia = mensaje.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\b/);
  if (!coincidencia) return null;
  const valor = coincidencia[1];
  const fecha = valor.includes("/")
    ? valor.split("/").reverse().map((parte, indice) => indice === 0 ? parte : parte.padStart(2, "0")).join("-")
    : valor;
  return parseFecha(fecha);
};

const extraerHora = (mensaje) => {
  const texto = mensaje.replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, " ");
  const coincidencia = texto.match(
    /\b(?:a\s+las?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la manana|de la tarde|de la noche)?|(\d{1,2}):([0-5]\d)\s*(am|pm)?|(\d{1,2})\s*(am|pm|de la manana|de la tarde|de la noche))\b/i
  );
  if (!coincidencia) return null;

  let hora = Number(coincidencia[1] || coincidencia[4] || coincidencia[7]);
  const minuto = Number(coincidencia[2] || coincidencia[5] || 0);
  const periodo = (coincidencia[3] || coincidencia[6] || coincidencia[8] || "").toLowerCase();
  if (periodo === "pm" || periodo === "de la tarde" || periodo === "de la noche") {
    if (hora < 12) hora += 12;
  } else if ((periodo === "am" || periodo === "de la manana") && hora === 12) {
    hora = 0;
  }
  if (hora > 23) return null;
  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
};

const extraerCupo = (mensaje, aceptarNumeroSuelto) => {
  const coincidencia = mensaje.match(/(?:^|\b(?:somos|seremos|para)\s*)([+-]?\d+)\s*(?:personas?|pax|comensales)\b|\bsomos\s+([+-]?\d+)\b/i);
  if (coincidencia) return Number(coincidencia[1] || coincidencia[2]);
  return aceptarNumeroSuelto && /^[+-]?\d+$/.test(mensaje.trim()) ? Number(mensaje.trim()) : null;
};

const faltanteReserva = (reserva) => {
  if (!reserva.dia) return "fecha";
  if (!reserva.hora) return "hora";
  if (!reserva.cupo) return "cantidad";
  if (!reserva.ocasion) return "ocasion";
  if (!reserva.detalles_preguntados) return "detalles";
  return null;
};

const pedirDatoReserva = (campo) => {
  if (campo === "fecha") return "¡Claro! ¿Qué fecha te gustaría reservar? Puedes decir «mañana» o escribirme una, como 25/12/2026.";
  if (campo === "hora") return "¿A qué hora te queda bien? Puedes escribirla, por ejemplo, como 12:00. Atendemos de lunes a viernes de 08:00 a 18:00 y los fines de semana de 09:00 a 17:00.";
  if (campo === "cantidad") return `¡Perfecto! ¿Cuántas personas vienen? Puedes responder solo con un número, como 3 (recibimos hasta ${MAX_PERSONAS_POR_HORARIO} por horario).`;
  if (campo === "ocasion") return "¿Hay alguna ocasión especial para tener en cuenta, como un cumpleaños o aniversario? Si no, dime «ninguna».";
  return "¿Tienes alguna nota adicional para el restaurante? Si no, responde «no».";
};

const esConfirmacion = (texto) =>
  ["si", "sí", "confirmar", "confirmo", "dale", "correcto", "ok"].includes(chatbot.normalizar(texto));

const esCancelacion = (texto) =>
  ["no", "cancelar", "cancela", "mejor no"].includes(chatbot.normalizar(texto));

const procesarReservaChat = async (mensaje, usuario, datosContexto) => {
  let reserva = datosContexto[CLAVE_RESERVA_CHAT]
    ? { ...datosContexto[CLAVE_RESERVA_CHAT] }
    : null;
  const intencionDetectada = reserva ? "crear_reserva" : (await chatbot.detectarIntencion(mensaje))?.nombre;
  if (!["crear_reserva", "hacer_reserva"].includes(intencionDetectada)) return null;
  const intencion = "crear_reserva";
  if (!usuario) {
    return {
      intencion,
      respuesta: "Para agendar una reserva desde el chat, primero inicia sesión y luego vuelve a escribirme.",
      reserva: null,
    };
  }

  if (!reserva) reserva = {};
  const texto = chatbot.normalizar(mensaje);

  if (reserva.confirmando && esConfirmacion(texto)) {
    const errorHorario = errorHorarioReserva(reserva.dia, reserva.hora);
    if (errorHorario) {
      return {
        intencion,
        respuesta: `${errorHorario} Dime otra hora y lo revisamos.`,
        reserva: { ...reserva, hora: null, confirmando: false },
      };
    }
    const datosReserva = { ...reserva };
    delete datosReserva.confirmando;
    delete datosReserva.detalles_preguntados;
    const creada = await crearConCapacidad(datosReserva, usuario._id);
    if (!creada) {
      return {
        intencion,
        respuesta: "Vaya, mientras confirmábamos ese horario se quedó sin espacio suficiente. ¿Me dices otra hora y lo revisamos?",
        reserva: { ...reserva, hora: null, confirmando: false },
      };
    }
    return {
      intencion,
      respuesta: `¡Listo! Tu mesa para ${personas(reserva.cupo)} el ${reserva.dia} a las ${reserva.hora} quedó registrada. El restaurante la confirmará pronto.`,
      reserva: null,
    };
  }

  if (reserva.confirmando && esCancelacion(texto)) {
    return { intencion, respuesta: "¡Claro! No guardé la reserva. Cuando quieras, podemos intentarlo de nuevo.", reserva: null };
  }

  const nuevaFecha = extraerFecha(mensaje);
  const nuevaHora = extraerHora(mensaje);
  const faltanteAntes = faltanteReserva(reserva);
  const nuevoCupo = extraerCupo(mensaje, faltanteAntes === "cantidad");
  if (nuevaFecha) reserva.dia = nuevaFecha;
  if (nuevaHora) reserva.hora = nuevaHora;
  if (nuevoCupo !== null) reserva.cupo = nuevoCupo;

  if (faltanteAntes === "ocasion" && !nuevaFecha && !nuevaHora && nuevoCupo === null) {
    const respuesta = chatbot.normalizar(mensaje);
    reserva.ocasion = ["no", "ninguna", "ninguno", "sin ocasion", "ninguna ocasion", "no aplica", "no hay"].includes(respuesta)
      ? "Sin ocasión"
      : mensaje;
  } else if (faltanteAntes === "detalles") {
    const respuesta = chatbot.normalizar(mensaje);
    reserva.detalles = ["no", "ninguna", "ninguno", "nada", "sin notas", "no aplica"].includes(respuesta)
      ? ""
      : mensaje;
    reserva.detalles_preguntados = true;
  }

  if (reserva.cupo !== undefined && reserva.cupo !== null && (!Number.isInteger(reserva.cupo) || reserva.cupo < 1)) {
    reserva.cupo = null;
    return {
      intencion,
      respuesta: `Para reservar necesito un número entero de al menos 1. ¿Cuántas personas vendrán?`,
      reserva,
    };
  }

  if (reserva.cupo > MAX_PERSONAS_POR_HORARIO) {
    reserva.cupo = null;
    return {
      intencion,
      respuesta: `Para ese horario podemos recibir hasta ${MAX_PERSONAS_POR_HORARIO} personas. ¿Cuántas serían?`,
      reserva,
    };
  }

  if (reserva.dia && new Date(`${reserva.dia}T00:00:00.000Z`) < new Date(`${hoyLocal()}T00:00:00.000Z`)) {
    reserva.dia = null;
    return { intencion, respuesta: "Uy, ese día ya pasó. ¿Qué otra fecha te queda bien? Puedes decir «mañana» o escribirla como 25/12/2026.", reserva };
  }

  if (reserva.dia && reserva.hora) {
    const errorHorario = errorHorarioReserva(reserva.dia, reserva.hora);
    if (errorHorario) {
      reserva.hora = null;
      return {
        intencion,
        respuesta: `${errorHorario} ¿Qué otra hora te quedaría bien?`,
        reserva: { ...reserva, confirmando: false },
      };
    }
  }

  const faltante = faltanteReserva(reserva);
  if (faltante) {
    return { intencion, respuesta: pedirDatoReserva(faltante), reserva: { ...reserva, confirmando: false } };
  }

  const disponibilidad = await consultarDisponibilidad(reserva.dia, reserva.hora);
  if (reserva.cupo > disponibilidad.disponibles) {
    reserva.hora = null;
    return {
      intencion,
      respuesta: `¡Qué pena! A esa hora solo quedan ${disponibilidad.disponibles} lugares. ¿Te sirve otra hora para ${personas(reserva.cupo)}?`,
      reserva: { ...reserva, confirmando: false },
    };
  }

  reserva.confirmando = true;
  return {
    intencion,
    respuesta: `¡Genial! Tenemos espacio para ${personas(reserva.cupo)} el ${reserva.dia} a las ${reserva.hora}. ¿Te la reservo? Responde «sí» para confirmar o «no» si prefieres dejarlo para otra ocasión.`,
    reserva,
  };
};

const resumenReserva = (reserva) =>
  `${(reserva.dia instanceof Date ? reserva.dia.toISOString() : String(reserva.dia)).slice(0, 10)} a las ${reserva.hora}, para ${personas(reserva.cupo)}`;

const esSolicitudEdicion = (texto) =>
  [
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
    "quiero cambiarla",
    "actualizar mi reserva",
  ].some((frase) => texto.includes(frase));

const confirmarCancelacion = (reserva) => ({
  intencion: "cancelar_reserva",
  respuesta: `¿Quieres cancelar tu reserva del ${resumenReserva(reserva)}? Responde «sí» para cancelarla o «no» si prefieres conservarla.`,
  cancelacion: { reserva_id: String(reserva._id), confirmando: true },
});

const esSolicitudCancelacion = (texto) =>
  ["cancelar", "cancela", "cancelarla"].includes(texto) ||
  [
    "cancelar mi reserva",
    "cancelar la reserva",
    "cancelar reserva",
    "cancelar mis reservas",
    "cancela la reserva",
    "cancela mi reserva",
    "quiero cancelar",
    "quiero cancelarla",
    "anular la reserva",
    "anular reserva",
  ].some((frase) => texto.includes(frase));

const procesarCancelacionChat = async (mensaje, usuario, datosContexto) => {
  let cancelacion = datosContexto[CLAVE_CANCELACION_CHAT]
    ? { ...datosContexto[CLAVE_CANCELACION_CHAT] }
    : null;
  const texto = chatbot.normalizar(mensaje);

  if (!cancelacion && !esSolicitudCancelacion(texto)) return null;

  if (!usuario) {
    return {
      intencion: "cancelar_reserva",
      respuesta: "Para cancelar una reserva desde el chat, primero inicia sesión.",
      cancelacion: null,
    };
  }

  if (cancelacion?.confirmando) {
    if (esConfirmacion(texto)) {
      const reserva = await cancelarPropia(cancelacion.reserva_id, usuario._id);
      return reserva
        ? {
            intencion: "cancelar_reserva",
            respuesta: `¡Hecho! Cancelé tu reserva del ${resumenReserva(reserva)}. El restaurante ya verá el estado actualizado.`,
            cancelacion: null,
          }
        : {
            intencion: "cancelar_reserva",
            respuesta: "No pude cancelarla; quizá ya está cancelada o la visita ya terminó.",
            cancelacion: null,
          };
    }
    if (esCancelacion(texto)) {
      return {
        intencion: "cancelar_reserva",
        respuesta: "Entendido, dejamos tu reserva como está.",
        cancelacion: null,
      };
    }
    return { intencion: "cancelar_reserva", respuesta: "¿La cancelamos? Dime «sí» para seguir o «no» para conservarla.", cancelacion };
  }

  if (cancelacion?.reserva_ids?.length) {
    const seleccion = Number(texto);
    if (!Number.isInteger(seleccion) || seleccion < 1 || seleccion > cancelacion.reserva_ids.length) {
      return {
        intencion: "cancelar_reserva",
        respuesta: `No identifiqué esa opción. Responde con el número de la reserva que quieres cancelar (1-${cancelacion.reserva_ids.length}).`,
        cancelacion,
      };
    }
    const reservaId = cancelacion.reserva_ids[seleccion - 1];
    const reserva = await Reservation.findOne({
      _id: reservaId,
      usuario_id: usuario._id,
      estado_reserva: { $in: ["pendiente", "confirmada"] },
    });
    if (!reserva) {
      return {
        intencion: "cancelar_reserva",
        respuesta: "Esa reserva ya no está disponible para cancelar. Si quieres, escribe «cancelar» y revisamos las que siguen activas.",
        cancelacion: null,
      };
    }
    return confirmarCancelacion(reserva);
  }

  const reservas = await Reservation.find({
    usuario_id: usuario._id,
    dia: { $gte: diaCalendarioHoy() },
    estado_reserva: { $in: ["pendiente", "confirmada"] },
  }).sort({ dia: 1, hora: 1 });

  if (reservas.length === 0) {
    return {
      intencion: "cancelar_reserva",
      respuesta: "No encuentro reservas próximas que todavía se puedan cancelar.",
      cancelacion: null,
    };
  }
  if (reservas.length === 1) return confirmarCancelacion(reservas[0]);

  return {
    intencion: "cancelar_reserva",
    respuesta: `Veo varias reservas próximas. ¿Cuál quieres cancelar? Elige el número:\n${reservas
      .map((reserva, indice) => `${indice + 1}) ${resumenReserva(reserva)}`)
      .join("\n")}`,
    cancelacion: { reserva_ids: reservas.map((reserva) => String(reserva._id)) },
  };
};

const iniciarEdicion = (reserva) => ({
  intencion: "editar_reserva",
  respuesta: `¡Claro! Tu reserva actual es para el ${resumenReserva(reserva)}. Dime qué quieres cambiar: puedes indicarme una nueva fecha, hora o cantidad de personas (también puedes cambiar varias a la vez).`,
  edicion: {
    reserva_id: String(reserva._id),
    dia: reserva.dia.toISOString().slice(0, 10),
    hora: reserva.hora,
    cupo: reserva.cupo,
    confirmando: false,
  },
});

const esFechaMencionada = (mensaje, texto) =>
  /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(mensaje) ||
  /\b(hoy|manana|pasado manana)\b/.test(texto);

const esHoraMencionada = (texto) =>
  /\b(?:a\s+las?\s+\d{1,2}|\d{1,2}:\d{1,2}|\d{1,2}\s*(?:am|pm|de la manana|de la tarde|de la noche))\b/.test(texto);

const procesarEdicionChat = async (mensaje, usuario, datosContexto) => {
  let edicion = datosContexto[CLAVE_EDICION_CHAT]
    ? { ...datosContexto[CLAVE_EDICION_CHAT] }
    : null;
  const texto = chatbot.normalizar(mensaje);

  if (!edicion && !esSolicitudEdicion(texto)) return null;
  if (!usuario) {
    return {
      intencion: "editar_reserva",
      respuesta: "¡Claro que sí! Para cambiar una reserva, primero inicia sesión.",
      edicion: null,
    };
  }

  if (!edicion) {
    const reservas = await Reservation.find({
      usuario_id: usuario._id,
      dia: { $gte: diaCalendarioHoy() },
      estado_reserva: { $in: ["pendiente", "confirmada"] },
    }).sort({ dia: 1, hora: 1 });

    if (reservas.length === 0) {
      return {
        intencion: "editar_reserva",
        respuesta: "No encuentro reservas próximas que todavía se puedan modificar.",
        edicion: null,
      };
    }
    if (reservas.length === 1) return iniciarEdicion(reservas[0]);

    return {
      intencion: "editar_reserva",
      respuesta: `Tienes varias reservas próximas. ¿Cuál quieres cambiar? Elige el número:\n${reservas
        .map((reserva, indice) => `${indice + 1}) ${resumenReserva(reserva)}`)
        .join("\n")}`,
      edicion: { reserva_ids: reservas.map((reserva) => String(reserva._id)) },
    };
  }

  if (edicion.reserva_ids?.length && !edicion.reserva_id) {
    const seleccion = Number(texto);
    if (!Number.isInteger(seleccion) || seleccion < 1 || seleccion > edicion.reserva_ids.length) {
      return {
        intencion: "editar_reserva",
        respuesta: `No identifiqué esa opción. Responde con el número de la reserva que quieres cambiar (1-${edicion.reserva_ids.length}).`,
        edicion,
      };
    }
    const reserva = await Reservation.findOne({
      _id: edicion.reserva_ids[seleccion - 1],
      usuario_id: usuario._id,
      estado_reserva: { $in: ["pendiente", "confirmada"] },
    });
    if (!reserva) {
      return {
        intencion: "editar_reserva",
        respuesta: "Esa reserva ya no está disponible para modificar. Escribe «editar mi reserva» para revisar las activas.",
        edicion: null,
      };
    }
    return iniciarEdicion(reserva);
  }

  if (edicion.confirmando) {
    if (esConfirmacion(texto)) {
      const errorHorario = errorHorarioReserva(edicion.dia, edicion.hora);
      if (errorHorario) {
        return {
          intencion: "editar_reserva",
          respuesta: `${errorHorario} Dime otra hora y vuelvo a revisar.`,
          edicion: { ...edicion, hora: null, confirmando: false },
        };
      }
      const actualizada = await actualizarConCapacidad(edicion.reserva_id, usuario._id, {
        dia: edicion.dia,
        hora: edicion.hora,
        cupo: edicion.cupo,
      });
      if (!actualizada) {
        return {
          intencion: "editar_reserva",
          respuesta: "Uy, ese horario ya no tiene espacio para todos. Dime otra hora y vuelvo a revisar.",
          edicion: { ...edicion, hora: null, confirmando: false },
        };
      }
      return {
        intencion: "editar_reserva",
        respuesta: `¡Listo! Actualicé tu reserva para el ${resumenReserva(actualizada)}.`,
        edicion: null,
      };
    }
    if (esCancelacion(texto)) {
      return {
        intencion: "editar_reserva",
        respuesta: "No hice ningún cambio; tu reserva sigue como estaba.",
        edicion: null,
      };
    }
    return {
      intencion: "editar_reserva",
      respuesta: "¿Guardamos estos cambios? Dime «sí» para aplicarlos o «no» para dejar tu reserva como está.",
      edicion,
    };
  }

  if (esCancelacion(texto)) {
    return {
      intencion: "editar_reserva",
      respuesta: "Entendido, no hice ningún cambio a tu reserva.",
      edicion: null,
    };
  }

  const nuevaFecha = extraerFecha(mensaje);
  const nuevaHora = extraerHora(mensaje);
  const nuevoCupo = extraerCupo(mensaje, true);
  if (esFechaMencionada(mensaje, texto) && !nuevaFecha) {
    return {
      intencion: "editar_reserva",
      respuesta: "Esa fecha no me quedó clara. Dímela como «mañana» o en formato DD/MM/AAAA.",
      edicion,
    };
  }
  if (esHoraMencionada(texto) && !nuevaHora) {
    return {
      intencion: "editar_reserva",
      respuesta: "No reconocí esa hora. ¿Me la escribes en formato de 24 horas, como 12:00?",
      edicion,
    };
  }
  if (/^\d+[.,]\d+$/.test(mensaje.trim())) {
    return {
      intencion: "editar_reserva",
      respuesta: "La cantidad debe ser un número entero. ¿Cuántas personas vendrán?",
      edicion,
    };
  }
  if (!nuevaFecha && !nuevaHora && nuevoCupo === null) {
    return {
      intencion: "editar_reserva",
      respuesta: "No alcancé a identificar el cambio. Dime la nueva fecha, hora o cantidad de personas; puedes cambiar varios datos a la vez.",
      edicion,
    };
  }

  if (nuevaFecha) {
    if (new Date(`${nuevaFecha}T00:00:00.000Z`) < new Date(`${hoyLocal()}T00:00:00.000Z`)) {
      return {
        intencion: "editar_reserva",
        respuesta: "Uy, esa fecha ya pasó. Elige un día de hoy en adelante.",
        edicion,
      };
    }
    edicion.dia = nuevaFecha;
  }
  if (nuevaHora) edicion.hora = nuevaHora;
  if (nuevoCupo !== null) edicion.cupo = nuevoCupo;

  if (!Number.isInteger(edicion.cupo) || edicion.cupo < 1) {
    return {
      intencion: "editar_reserva",
      respuesta: "La cantidad debe ser un número entero de al menos 1. ¿Cuántas personas vendrán?",
      edicion,
    };
  }
  if (edicion.cupo > MAX_PERSONAS_POR_HORARIO) {
    return {
      intencion: "editar_reserva",
      respuesta: `Para un horario recibimos hasta ${MAX_PERSONAS_POR_HORARIO} personas. ¿Cuántas serían?`,
      edicion,
    };
  }

  const errorHorario = errorHorarioReserva(edicion.dia, edicion.hora);
  if (errorHorario) {
    return {
      intencion: "editar_reserva",
      respuesta: `${errorHorario} Indícame una hora dentro del horario de atención.`,
      edicion: { ...edicion, hora: null, confirmando: false },
    };
  }

  const disponibilidad = await consultarDisponibilidad(edicion.dia, edicion.hora, edicion.reserva_id);
  if (edicion.cupo > disponibilidad.disponibles) {
    return {
      intencion: "editar_reserva",
      respuesta: `A esa hora solo quedan ${disponibilidad.disponibles} lugares. Prueba con otra hora o con menos personas.`,
      edicion: { ...edicion, hora: null },
    };
  }

  edicion.confirmando = true;
  return {
    intencion: "editar_reserva",
    respuesta: `Los cambios quedarían así: ${resumenReserva(edicion)}. ¿Los guardamos? Dime «sí» para confirmar o «no» para conservar la reserva actual.`,
    edicion,
  };
};

// Sin conversacion_id se continúa la última conversación activa del usuario,
// o se crea una nueva si no tiene ninguna.
const obtenerConversacion = async (req, conversacionId) => {
  if (conversacionId) {
    const conversacion = await ChatConversation.findById(conversacionId);
    if (!conversacion) throw new HttpError(404, "Conversación no encontrada");
    verificarDueno(req, conversacion.usuario_id);
    if (conversacion.estado !== "activa") {
      throw new HttpError(400, `La conversación está ${conversacion.estado}`);
    }
    return conversacion;
  }

  const activa = await ChatConversation.findOne({
    usuario_id: req.usuario._id,
    estado: "activa",
  }).sort({ fecha_ultima_actividad: -1 });

  return activa || new ChatConversation({ usuario_id: req.usuario._id });
};

const enviarMensaje = async (req, res) => {
  const mensaje = typeof req.body?.mensaje === "string" ? req.body.mensaje.trim() : "";
  if (!mensaje) throw new HttpError(400, "El mensaje es obligatorio");
  if (mensaje.length > MAX_LARGO_MENSAJE) {
    throw new HttpError(400, `El mensaje no puede superar ${MAX_LARGO_MENSAJE} caracteres`);
  }

  // Visitante sin sesión: se responde, pero no se guarda la conversación
  // (cada conversación pertenece a un usuario).
  if (!req.usuario) {
    const resultadoCancelacion = await procesarCancelacionChat(mensaje, null, {});
    if (resultadoCancelacion) {
      return res.json({
        conversacion_id: null,
        intencion: resultadoCancelacion.intencion,
        respuesta: resultadoCancelacion.respuesta,
      });
    }
    const resultadoEdicion = await procesarEdicionChat(mensaje, null, {});
    if (resultadoEdicion) {
      return res.json({
        conversacion_id: null,
        intencion: resultadoEdicion.intencion,
        respuesta: resultadoEdicion.respuesta,
      });
    }
    const resultadoReserva = await procesarReservaChat(mensaje, null, {});
    if (resultadoReserva) {
      return res.json({
        conversacion_id: null,
        intencion: resultadoReserva.intencion,
        respuesta: resultadoReserva.respuesta,
      });
    }
    const { intencion, respuesta } = await chatbot.responder(mensaje, null);
    return res.json({ conversacion_id: null, intencion, respuesta });
  }

  const conversacion = await obtenerConversacion(req, req.body.conversacion_id);
  const datosContexto = conversacion.contexto?.datos || {};
  const resultadoCancelacion = await procesarCancelacionChat(mensaje, req.usuario, datosContexto);
  const resultadoEdicion = resultadoCancelacion
    ? null
    : await procesarEdicionChat(mensaje, req.usuario, datosContexto);
  const resultadoReserva = resultadoCancelacion || resultadoEdicion
    ? null
    : await procesarReservaChat(mensaje, req.usuario, datosContexto);
  const resultado = resultadoCancelacion || resultadoEdicion || resultadoReserva || (await chatbot.responder(mensaje, req.usuario));
  const { intencion, respuesta } = resultado;
  const ahora = new Date();

  conversacion.mensajes.push(
    { tipo: "usuario", mensaje, intencion, fecha_hora: ahora },
    { tipo: "bot", mensaje: respuesta, intencion, fecha_hora: ahora }
  );
  conversacion.fecha_ultima_actividad = ahora;
  const datosNuevos = { ...datosContexto, ultima_intencion: intencion };
  if (resultadoReserva?.reserva) datosNuevos[CLAVE_RESERVA_CHAT] = resultadoReserva.reserva;
  else delete datosNuevos[CLAVE_RESERVA_CHAT];
  if (resultadoCancelacion?.cancelacion) datosNuevos[CLAVE_CANCELACION_CHAT] = resultadoCancelacion.cancelacion;
  else delete datosNuevos[CLAVE_CANCELACION_CHAT];
  if (resultadoEdicion?.edicion) datosNuevos[CLAVE_EDICION_CHAT] = resultadoEdicion.edicion;
  else delete datosNuevos[CLAVE_EDICION_CHAT];
  conversacion.contexto = { datos: datosNuevos };
  await conversacion.save();

  res.json({ conversacion_id: conversacion.id, intencion, respuesta });
};

// Las propias. Un admin puede ver todas con ?todas=true. Filtro: ?estado=
const listarConversaciones = async (req, res) => {
  const filtro = pick(req.query, ["estado"]);
  if (!(esAdmin(req) && req.query.todas === "true")) filtro.usuario_id = req.usuario._id;

  const conversaciones = await ChatConversation.find(filtro)
    .select("-mensajes")
    .sort({ fecha_ultima_actividad: -1 });
  res.json(conversaciones);
};

const obtenerConversacionPorId = async (req, res) => {
  const conversacion = await ChatConversation.findById(req.params.id);
  if (!conversacion) throw new HttpError(404, "Conversación no encontrada");
  verificarDueno(req, conversacion.usuario_id);
  res.json(conversacion);
};

const finalizarConversacion = async (req, res) => {
  const conversacion = await ChatConversation.findById(req.params.id);
  if (!conversacion) throw new HttpError(404, "Conversación no encontrada");
  verificarDueno(req, conversacion.usuario_id);
  if (conversacion.estado !== "activa") {
    throw new HttpError(400, `La conversación ya está ${conversacion.estado}`);
  }

  conversacion.estado = "finalizada";
  await conversacion.save();
  res.json(conversacion);
};

const CAMPOS_INTENCION = ["nombre", "descripcion", "activa", "palabras_clave", "respuestas"];

const listarIntenciones = async (req, res) => {
  const intenciones = await ChatIntent.find().sort({ nombre: 1 });
  res.json(intenciones);
};

const crearIntencion = async (req, res) => {
  const intencion = await ChatIntent.create(pick(req.body, CAMPOS_INTENCION));
  res.status(201).json(intencion);
};

const actualizarIntencion = async (req, res) => {
  const intencion = await ChatIntent.findByIdAndUpdate(
    req.params.id,
    pick(req.body, CAMPOS_INTENCION),
    { returnDocument: "after", runValidators: true }
  );
  if (!intencion) throw new HttpError(404, "Intención no encontrada");
  res.json(intencion);
};

// Las conversaciones guardan el nombre de la intención como texto,
// así que borrarla no rompe el historial.
const eliminarIntencion = async (req, res) => {
  const intencion = await ChatIntent.findByIdAndDelete(req.params.id);
  if (!intencion) throw new HttpError(404, "Intención no encontrada");
  res.status(204).end();
};

module.exports = {
  enviarMensaje,
  listarConversaciones,
  obtenerConversacionPorId,
  finalizarConversacion,
  listarIntenciones,
  crearIntencion,
  actualizarIntencion,
  eliminarIntencion,
};
