const { describe, test } = require("node:test");
const { expect } = require("./helpers");
const { errorHorarioReserva } = require("../src/utils/horarioReservas");

const ahora = new Date("2026-11-13T15:00:00Z");

describe("Horario de reservas", () => {
  test("aplica la apertura y el cierre de días laborales y fines de semana", () => {
    expect(errorHorarioReserva("2026-11-16", "08:00", ahora)).toBe(null);
    expect(errorHorarioReserva("2026-11-16", "17:59", ahora)).toBe(null);
    expect(errorHorarioReserva("2026-11-16", "18:00", ahora)).toMatch(/fuera de atención/);

    expect(errorHorarioReserva("2026-11-14", "09:00", ahora)).toBe(null);
    expect(errorHorarioReserva("2026-11-14", "08:59", ahora)).toMatch(/fuera de atención/);
    expect(errorHorarioReserva("2026-11-15", "16:59", ahora)).toBe(null);
    expect(errorHorarioReserva("2026-11-15", "17:00", ahora)).toMatch(/fuera de atención/);
  });

  test("rechaza fechas inválidas o pasadas y horas que ya pasaron hoy", () => {
    expect(errorHorarioReserva("2026-11-12", "12:00", ahora)).toMatch(/fecha pasada/);
    expect(errorHorarioReserva("2026-02-30", "12:00", ahora)).toMatch(/fecha debe ser válida/);
    expect(errorHorarioReserva("2026-11-13", "09:59", ahora)).toMatch(/hora ya pasó/);
    expect(errorHorarioReserva("2026-11-13", "10:00", ahora)).toMatch(/hora ya pasó/);
    expect(errorHorarioReserva("2026-11-13", "10:01", ahora)).toBe(null);
  });
});
