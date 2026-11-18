// APIs externas gratuitas (clima, festivos, Telegram, domicilio). Se reemplaza
// global.fetch: nada sale a internet.
const { describe, test, before, after, beforeEach, afterEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect } = require("./helpers");
const { vaciarCache } = require("../src/utils/cache");

const fetchOriginal = global.fetch;
let d;
const ENTORNO = ["OPENWEATHER_API_KEY", "LOCAL_LAT", "LOCAL_LON"];

// Lo que pide el backend y lo que la "API" responde, por URL.
let llamadas;
let respuestas;
const simular = () => {
  llamadas = [];
  global.fetch = async (url, opciones = {}) => {
    const texto = String(url);
    llamadas.push({ url: texto, opciones });
    const respuesta = respuestas.find(([patron]) => patron.test(texto));
    if (!respuesta) throw new Error(`Sin red en las pruebas: ${texto}`);
    const [, status, cuerpo] = respuesta;
    return { ok: status < 400, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) };
  };
};

before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);
beforeEach(async () => {
  await limpiar();
  d = await datosBase();
  vaciarCache();
  respuestas = [];
  simular();
});
afterEach(() => {
  global.fetch = fetchOriginal;
  for (const v of ENTORNO) delete process.env[v];
});

describe("Clima", () => {
  const OPENWEATHER = /api\.openweathermap\.org/;

  test("sin clave responde 204 y no llama a nadie", async () => {
    const res = await api().get("/api/clima");
    expect(res.status).toBe(204);
    expect(llamadas).toHaveLength(0);
  });

  test("traduce la respuesta, usa la ubicación del local y la guarda 15 minutos", async () => {
    process.env.OPENWEATHER_API_KEY = "clave-prueba";
    process.env.LOCAL_LAT = "2.93";
    respuestas.push([OPENWEATHER, 200, { main: { temp: 29.6 }, weather: [{ main: "Clouds", description: "nubes dispersas" }] }]);

    const [a, b] = await Promise.all([api().get("/api/clima"), api().get("/api/clima")]);
    expect(a.status).toBe(200);
    expect(a.body).toEqual({ temperatura: 30, descripcion: "nubes dispersas", tipo: "nublado" });
    expect(b.body.temperatura).toBe(30);
    await api().get("/api/clima");
    // Tres visitas, una sola llamada a OpenWeather.
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toMatch(/lat=2\.93/);
    expect(llamadas[0].url).toMatch(/units=metric/);
  });

  test("si OpenWeather falla responde 204 y lo vuelve a intentar después", async () => {    process.env.OPENWEATHER_API_KEY = "clave-prueba";
    respuestas.push([OPENWEATHER, 401, { message: "Invalid API key" }]);
    expect((await api().get("/api/clima")).status).toBe(204);
    expect((await api().get("/api/clima")).status).toBe(204);
    expect(llamadas).toHaveLength(2);
  });
});

describe("Festivos", () => {
  const NAGER = /date\.nager\.at\/api\/v3\/PublicHolidays\/2026\/CO/;
  const { festivosCalculados } = require("../src/services/festivos");

  test("el cálculo propio sigue la Ley Emiliani", () => {
    const de2026 = festivosCalculados(2026);
    expect(de2026).toHaveLength(18);
    const fechas = Object.fromEntries(de2026.map((f) => [f.nombre, f.fecha]));
    expect(fechas["Viernes Santo"]).toBe("2026-04-03");
    expect(fechas["Día de los Reyes Magos"]).toBe("2026-01-12");
    expect(fechas["Ascensión del Señor"]).toBe("2026-05-18");
    expect(fechas["Todos los Santos"]).toBe("2026-11-02");
    expect(fechas["Independencia de Cartagena"]).toBe("2026-11-16");
  });

  test("usa Nager.Date y lo guarda; si no responde, usa el cálculo propio", async () => {
    respuestas.push([NAGER, 200, [{ date: "2026-11-16", localName: "Independencia de Cartagena", name: "Independence of Cartagena" }]]);
    const res = await api().get("/api/festivos?anio=2026");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ fecha: "2026-11-16", nombre: "Independencia de Cartagena" }]);
    await api().get("/api/festivos?anio=2026");
    expect(llamadas).toHaveLength(1);

    respuestas = [];
    const sinRed = await api().get("/api/festivos?anio=2027");
    expect(sinRed.body).toHaveLength(18);
    expect((await api().get("/api/festivos?anio=1800")).status).toBe(400);
  });

  test("un festivo se reserva con el horario del fin de semana", async () => {
    // Sin red: el lunes 7 de diciembre de 2026 no es festivo, el martes 8 sí.
    const { revisarHorarioReserva } = require("../src/services/festivos");
    const ahora = new Date("2026-11-20T15:00:00Z");
    expect(await revisarHorarioReserva("2026-12-07", "08:00", ahora)).toBe(null);
    expect(await revisarHorarioReserva("2026-12-08", "08:00", ahora)).toMatch(/festivo \(Día de la Inmaculada Concepción\)/);
    expect(await revisarHorarioReserva("2026-12-08", "09:00", ahora)).toBe(null);
    expect(await revisarHorarioReserva("2026-12-08", "17:00", ahora)).toMatch(/de 09:00 a 17:00/);

    // La API de reservas aplica la misma regla.
    const reservar = (hora) =>
      api().post("/api/reservas").set(bearer(d.tokenCliente)).send({ dia: "2026-12-08", hora, cupo: 2 });
    expect((await reservar("08:30")).status).toBe(400);
    expect((await reservar("10:00")).status).toBe(201);
  });
});
