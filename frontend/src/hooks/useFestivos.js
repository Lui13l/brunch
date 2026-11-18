import { useEffect, useState } from "react";
import { api } from "../api/api";

// Una petición por año en toda la visita: la portada y las reservas comparten
// la misma promesa. Si falla, se olvida para que se pueda volver a intentar.
const porAnio = new Map();

const festivosDe = (anio) => {
  if (!porAnio.has(anio)) {
    porAnio.set(
      anio,
      api.get(`/festivos?anio=${anio}`).catch(() => {
        porAnio.delete(anio);
        return [];
      }),
    );
  }
  return porAnio.get(anio);
};

/**
 * Festivos de Colombia de los años indicados: [{ fecha, nombre }]. Mientras
 * cargan (o si fallan) es una lista vacía y el horario se ve como día común.
 */
export function useFestivos(...anios) {
  const [festivos, setFestivos] = useState([]);
  const clave = [...new Set(anios.filter(Boolean))].sort().join(",");

  useEffect(() => {
    let vigente = true;
    const lista = clave ? clave.split(",").map(Number) : [];
    Promise.all(lista.map(festivosDe)).then((todos) => vigente && setFestivos(todos.flat()));
    return () => {
      vigente = false;
    };
  }, [clave]);

  return festivos;
}
