import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/sesion";

// Carga, error y recarga: el mismo patrón que repiten todas las pantallas de
// administración. `url` puede ser una lista y entonces `datos` también lo es.
export function useRecurso(url) {
  const { pedir } = useAuth();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  // Una lista nueva en cada render volvería a disparar la carga en bucle, así que
  // la dependencia es su texto, no la lista.
  const claves = Array.isArray(url) ? url.join("|") : url;

  const cargar = useCallback(async () => {
    const urls = claves.split("|");
    try {
      const respuestas = await Promise.all(urls.map((u) => pedir(u)));
      setDatos(urls.length === 1 ? respuestas[0] : respuestas);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [pedir, claves]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { datos, error, setError, cargando, recargar: cargar };
}
