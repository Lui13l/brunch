const { diaLocal, fechaLocal, parseFecha } = require("./tiempo");

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const HORARIO_SEMANA = { apertura: "08:00", cierre: "18:00" };
const HORARIO_FIN_SEMANA = { apertura: "09:00", cierre: "17:00" };

const errorHorarioReserva = (dia, hora, ahora = new Date()) => {
  if (!parseFecha(dia)) return "La fecha debe ser válida y tener el formato AAAA-MM-DD.";
  if (dia < diaLocal(ahora)) return "No se puede reservar en una fecha pasada.";
  if (!HORA.test(hora || "")) return "La hora debe tener formato HH:MM (24 horas).";

  const diaSemana = new Date(`${dia}T00:00:00.000Z`).getUTCDay();
  const horario = diaSemana === 0 || diaSemana === 6 ? HORARIO_FIN_SEMANA : HORARIO_SEMANA;
  if (hora < horario.apertura || hora >= horario.cierre) {
    return "Ese horario queda fuera de atención. Atendemos de lunes a viernes de 08:00 a 18:00 y los fines de semana de 09:00 a 17:00; elige una hora antes del cierre.";
  }

  if (dia === diaLocal(ahora) && hora <= fechaLocal(ahora).slice(11, 16)) {
    return "Esa hora ya pasó en la hora local del restaurante. Elige una hora futura.";
  }

  return null;
};

module.exports = { errorHorarioReserva };
