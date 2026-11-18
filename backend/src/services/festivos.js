const { conCache } = require("../utils/cache");
const { errorHorarioReserva } = require("../utils/horarioReservas");
const { diaLocal } = require("../utils/tiempo");

// Los festivos de un año no cambian: con pedirlos una vez al día sobra.
const VIGENCIA_MS = 24 * 60 * 60_000;

// --- Cálculo propio, para cuando Nager.Date no responde ---
// Las reservas no pueden depender de la red: si la API se cae, los festivos
// salen de la ley colombiana (Ley 51 de 1983, "Ley Emiliani").

const iso = (fecha) => fecha.toISOString().slice(0, 10);
const sumarDias = (fecha, dias) => new Date(fecha.getTime() + dias * 86_400_000);
// Los festivos que se trasladan pasan al lunes siguiente (si no caen en lunes).
const alLunes = (fecha) => sumarDias(fecha, (8 - fecha.getUTCDay()) % 7);

// Domingo de Pascua (algoritmo de Gauss para el calendario gregoriano).
const pascua = (anio) => {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
};

const festivosCalculados = (anio) => {
  const fecha = (mes, dia) => new Date(Date.UTC(anio, mes - 1, dia));
  const domingo = pascua(anio);
  const lista = [
    [fecha(1, 1), "Año Nuevo"],
    [alLunes(fecha(1, 6)), "Día de los Reyes Magos"],
    [alLunes(fecha(3, 19)), "Día de San José"],
    [sumarDias(domingo, -3), "Jueves Santo"],
    [sumarDias(domingo, -2), "Viernes Santo"],
    [fecha(5, 1), "Día del Trabajo"],
    [sumarDias(domingo, 43), "Ascensión del Señor"],
    [sumarDias(domingo, 64), "Corpus Christi"],
    [sumarDias(domingo, 71), "Sagrado Corazón"],
    [alLunes(fecha(6, 29)), "San Pedro y San Pablo"],
    [fecha(7, 20), "Día de la Independencia"],
    [fecha(8, 7), "Batalla de Boyacá"],
    [alLunes(fecha(8, 15)), "La Asunción de la Virgen"],
    [alLunes(fecha(10, 12)), "Día de la Raza"],
    [alLunes(fecha(11, 1)), "Todos los Santos"],
    [alLunes(fecha(11, 11)), "Independencia de Cartagena"],
    [fecha(12, 8), "Día de la Inmaculada Concepción"],
    [fecha(12, 25), "Navidad"],
  ];
  return lista.map(([f, nombre]) => ({ fecha: iso(f), nombre })).sort((x, y) => x.fecha.localeCompare(y.fecha));
};

const pedirNager = async (anio) => {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${anio}/CO`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Nager.Date respondió ${res.status}`);
  const datos = await res.json();
  if (!Array.isArray(datos) || datos.length === 0) throw new Error("Nager.Date no trajo festivos");
  return datos.map((f) => ({ fecha: f.date, nombre: f.localName || f.name }));
};

/** Festivos de Colombia de un año: [{ fecha: "AAAA-MM-DD", nombre }]. Nunca lanza. */
const festivosDe = async (anio) => {
  try {
    return await conCache(`festivos:${anio}`, VIGENCIA_MS, () => pedirNager(anio));
  } catch (error) {
    console.error(`No se pudieron consultar los festivos de ${anio}; se usan los calculados:`, error.message);
    return festivosCalculados(anio);
  }
};

/** Nombre del festivo de ese día ("AAAA-MM-DD"), o null si es día común. */
const esFestivo = async (dia) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia || "")) return null;
  const festivos = await festivosDe(Number(dia.slice(0, 4)));
  return festivos.find((f) => f.fecha === dia)?.nombre ?? null;
};

/** errorHorarioReserva sabiendo si el día es festivo (se atiende como fin de semana). */
const revisarHorarioReserva = async (dia, hora, ahora = new Date()) =>
  errorHorarioReserva(dia, hora, ahora, await esFestivo(dia));

/** Hoy, en la hora del restaurante: { dia, festivo } con el nombre o null. */
const hoy = async (ahora = new Date()) => {
  const dia = diaLocal(ahora);
  return { dia, festivo: await esFestivo(dia) };
};

module.exports = { festivosDe, esFestivo, revisarHorarioReserva, hoy, festivosCalculados };
