// Datos del local en un solo lugar: los usan el inicio, el mapa y el pie.

export const LOCAL = {
  direccion: "Calle del Sabor 123, Ciudad del Brunch",
  telefono: "+57 000 000 0000",
  ciudad: "Neiva",
};

// Horas en formato 24 h, hora de Colombia. Los festivos se atienden con el
// horario del fin de semana (el backend aplica la misma regla a las reservas).
export const HORARIO = {
  semana: { abre: 8, cierra: 18, texto: "Lunes a viernes", horas: "8:00 – 18:00" },
  finde: { abre: 9, cierra: 17, texto: "Sábados, domingos y festivos", horas: "9:00 – 17:00" },
};

const ZONA = "America/Bogota";

// Día ("AAAA-MM-DD"), día de la semana ("lun", "sáb"...) y hora decimal en Colombia.
const enColombia = (fecha) => {
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(fecha);
  const valor = (tipo) => partes.find((p) => p.type === tipo)?.value ?? "";
  return {
    dia: `${valor("year")}-${valor("month")}-${valor("day")}`,
    semana: valor("weekday").replace(".", "").toLowerCase(),
    hora: (Number(valor("hour")) % 24) + Number(valor("minute")) / 60,
  };
};

/** Nombre del festivo de ese día ("AAAA-MM-DD"), o null. */
export const festivoDe = (dia, festivos = []) => festivos.find((f) => f.fecha === dia)?.nombre ?? null;

/** El tramo de horario de un día: fin de semana o festivo, o entre semana. */
export const horarioDelDia = (dia, festivos = []) => {
  const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
  return semana === 0 || semana === 6 || festivoDe(dia, festivos) ? HORARIO.finde : HORARIO.semana;
};

// Dice si el local está abierto ahora mismo y hasta (o desde) qué hora.
// `festivos`: [{ fecha, nombre }] de GET /api/festivos; sin ellos, el día es común.
export const estadoDelLocal = (ahora = new Date(), festivos = []) => {
  const { dia, hora } = enColombia(ahora);
  const hoy = horarioDelDia(dia, festivos);
  const festivo = festivoDe(dia, festivos);
  const prefijo = festivo ? "Hoy es festivo. " : "";

  if (hora >= hoy.abre && hora < hoy.cierra) {
    return { abierto: true, texto: `${prefijo}Abierto hasta las ${hoy.cierra}:00` };
  }
  if (hora < hoy.abre) {
    return { abierto: false, texto: `${prefijo}Abrimos hoy a las ${hoy.abre}:00` };
  }

  // Ya cerró: el horario de mañana depende de qué día (o festivo) es.
  const manana = enColombia(new Date(ahora.getTime() + 24 * 60 * 60_000)).dia;
  return { abierto: false, texto: `Abrimos mañana a las ${horarioDelDia(manana, festivos).abre}:00` };
};
