// Dónde está el restaurante. Lo usan el clima y el cálculo del domicilio.
// Mientras no haya local real, es el punto del mapa de la web (Neiva); se
// cambia con LOCAL_LAT y LOCAL_LON sin tocar código.
const POR_DEFECTO = { lat: 2.942, lon: -75.2998 };

const numero = (texto, defecto) => {
  const n = Number.parseFloat(texto);
  return Number.isFinite(n) ? n : defecto;
};

// Se lee cada vez: así una prueba puede cambiar las variables de entorno.
const ubicacionLocal = () => ({
  lat: numero(process.env.LOCAL_LAT, POR_DEFECTO.lat),
  lon: numero(process.env.LOCAL_LON, POR_DEFECTO.lon),
});

module.exports = { ubicacionLocal };
