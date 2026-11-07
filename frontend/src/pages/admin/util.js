import { useCallback, useEffect, useState } from "react";

// Ayudas del panel de administración (sin JSX).

// Carga una lista y expone recargar/error. `cargar` debe ser estable (useCallback).
export function useCarga(cargar) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await cargar());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [cargar]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { datos, setDatos, error, setError, cargando, recargar };
}

export const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const rangoDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - (dias - 1));
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { desde: iso, hasta: hoy() };
};

export const pesos = (v) => `$${Number(v || 0).toLocaleString("es-CO")}`;
export const fechaHora = (f) => (f ? String(f).replace("T", " ").slice(0, 16) : "");
export const fechaCorta = (f) => {
  if (!f) return "";
  const d = new Date(f);
  return Number.isNaN(d.getTime()) ? String(f) : d.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
};
export const codigo = (id) => `#${String(id ?? "").slice(-6).toUpperCase()}`;
