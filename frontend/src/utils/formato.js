// Formatos que comparten la web y el panel de administración.

export const formatearPrecio = (valor) => `$${Number(valor || 0).toLocaleString("es-CO")}`;

// Los últimos 6 caracteres del id, igual que en la auditoría del backend: "#2A04EA".
export const codigoCorto = (id) => `#${String(id ?? "").slice(-6).toUpperCase()}`;

// Fecha legible en es-CO. Un día suelto ("2026-03-10", como Reservation.dia) se
// toma a mediodía para que la zona horaria no lo corra al día anterior.
export const formatearFecha = (fecha, soloFecha = false) => {
  if (!fecha) return "Sin fecha";
  const valor = new Date(
    typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `${fecha}T12:00:00` : fecha,
  );
  if (Number.isNaN(valor.getTime())) return "Sin fecha";
  return valor.toLocaleString(
    "es-CO",
    soloFecha ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" },
  );
};
