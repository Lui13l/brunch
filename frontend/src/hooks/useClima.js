import { useEffect, useState } from "react";
import { obtenerClima } from "../services/climaService";

// Una sola petición por visita: la portada y el menú comparten la misma
// promesa. Si falla, se olvida para que la próxima página lo vuelva a intentar.
let pedido = null;

const climaCompartido = () => {
  pedido ??= obtenerClima().catch(() => {
    pedido = null;
    return null;
  });
  return pedido;
};

/** El clima de hoy donde está el local, o null mientras carga o si no hay datos. */
export function useClima() {
  const [clima, setClima] = useState(null);

  useEffect(() => {
    let vigente = true;
    climaCompartido().then((datos) => vigente && setClima(datos));
    return () => {
      vigente = false;
    };
  }, []);

  return clima;
}
