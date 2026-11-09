// Fechas para el personal del restaurante. En la base se guardan instantes
// UTC reales; hacia la app de comandas salen como "hora de pared" de la zona
// del restaurante (sin Z), que es lo que la app muestra y compara.
const zona = () => process.env.ZONA_HORARIA || "America/Bogota";

const formateadores = new Map();
const formateador = (tz) => {
  if (!formateadores.has(tz)) {
    formateadores.set(
      tz,
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
    );
  }
  return formateadores.get(tz);
};

const partes = (date) => {
  const p = {};
  for (const { type, value } of formateador(zona()).formatToParts(date)) p[type] = value;
  return p;
};

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

// "2026-03-10T12:05:09.123" en la zona del restaurante.
const fechaLocal = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const p = partes(d);
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${ms}`;
};

const diaLocal = (date) => (date ? fechaLocal(date).slice(0, 10) : null);

// Diferencia (ms) entre la hora de pared de la zona y UTC en ese instante.
const desfase = (date) => {
  const p = partes(date);
  const pared = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return pared - Math.floor(date.getTime() / 1000) * 1000;
};

// Instante UTC en que empieza el día "AAAA-MM-DD" en la zona del restaurante.
const inicioDiaLocal = (dia) => {
  const [y, m, d] = dia.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  return new Date(guess.getTime() - desfase(guess));
};

const hoyLocal = () => diaLocal(new Date());

// Fechas de calendario guardadas como medianoche UTC (p. ej. Reservation.dia):
// el "hoy" que les corresponde es el día del restaurante, no el de UTC.
const diaCalendarioHoy = () => new Date(`${hoyLocal()}T00:00:00.000Z`);

const sumarDias = (dia, n) => {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

// Rango [inicio, fin) en instantes UTC para filtrar por días del restaurante,
// incluyendo el día "hasta" completo. Un extremo sin indicar queda undefined.
const rangoLocal = (desde, hasta) => ({
  inicio: desde ? inicioDiaLocal(desde) : undefined,
  fin: hasta ? inicioDiaLocal(sumarDias(hasta, 1)) : undefined,
});

// Devuelve el mismo "AAAA-MM-DD" si es una fecha real; si no, null.
const parseFecha = (valor) => {
  if (typeof valor !== "string" || !DIA_RE.test(valor)) return null;
  const date = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === valor ? valor : null;
};

module.exports = { fechaLocal, diaLocal, inicioDiaLocal, hoyLocal, diaCalendarioHoy, rangoLocal, parseFecha };
