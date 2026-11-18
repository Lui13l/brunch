const { conCache } = require("../utils/cache");
const { ubicacionLocal } = require("../utils/local");

// Una llamada cada 15 minutos alcanza: el clima no cambia más rápido y el plan
// gratuito de OpenWeather tiene tope diario.
const VIGENCIA_MS = 15 * 60_000;

// Lo que la web necesita saber, sin los nombres de OpenWeather ("Clear"...).
const TIPOS = {
  Clear: "despejado",
  Clouds: "nublado",
  Rain: "lluvia",
  Drizzle: "lluvia",
  Thunderstorm: "lluvia",
};

const pedirClima = async (clave) => {
  const { lat, lon } = ubicacionLocal();
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.search = new URLSearchParams({ lat, lon, appid: clave, units: "metric", lang: "es" });
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OpenWeather respondió ${res.status}`);
  const datos = await res.json();
  return {
    temperatura: Math.round(datos.main.temp),
    descripcion: datos.weather?.[0]?.description ?? "",
    tipo: TIPOS[datos.weather?.[0]?.main] ?? "otro",
  };
};

/**
 * El clima de ahora donde está el local, o null si no se puede saber (sin
 * clave, sin red, o la API falló). Nunca lanza: el clima es un adorno.
 */
const climaActual = async () => {
  const clave = process.env.OPENWEATHER_API_KEY;
  if (!clave) return null;
  try {
    return await conCache("clima", VIGENCIA_MS, () => pedirClima(clave));
  } catch (error) {
    console.error("No se pudo consultar el clima:", error.message);
    return null;
  }
};

module.exports = { climaActual };
