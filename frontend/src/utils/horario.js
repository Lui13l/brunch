// Datos del local en un solo lugar: los usan el inicio, el mapa y el pie.

export const LOCAL = {
  direccion: "Calle del Sabor 123, Ciudad del Brunch",
  telefono: "+57 000 000 0000",
  ciudad: "Neiva",
};

// Horas en formato 24 h, hora de Colombia.
export const HORARIO = {
  semana: { abre: 8, cierra: 18, texto: "Lunes a viernes", horas: "8:00 – 18:00" },
  finde: { abre: 9, cierra: 17, texto: "Sábados y domingos", horas: "9:00 – 17:00" },
};

const ZONA = "America/Bogota";

const tramoDe = (diaSemana) => (diaSemana === "sáb" || diaSemana === "dom" ? HORARIO.finde : HORARIO.semana);

// Dice si el local está abierto ahora mismo y hasta (o desde) qué hora.
export const estadoDelLocal = (ahora = new Date()) => {
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(ahora);

  const valor = (tipo) => partes.find((p) => p.type === tipo)?.value ?? "";
  const dia = valor("weekday").replace(".", "").toLowerCase();
  const hora = (Number(valor("hour")) % 24) + Number(valor("minute")) / 60;
  const hoy = tramoDe(dia);

  if (hora >= hoy.abre && hora < hoy.cierra) {
    return { abierto: true, texto: `Abierto hasta las ${hoy.cierra}:00` };
  }
  if (hora < hoy.abre) {
    return { abierto: false, texto: `Abrimos hoy a las ${hoy.abre}:00` };
  }

  // Ya cerró: mañana es fin de semana si hoy es viernes o sábado.
  const manana = dia === "vie" || dia === "sáb" ? HORARIO.finde : HORARIO.semana;
  return { abierto: false, texto: `Abrimos mañana a las ${manana.abre}:00` };
};
