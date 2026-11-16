import { useCallback, useEffect, useRef, useState } from "react";
import PantallaCarga from "../components/PantallaCarga";
import hojaPancito from "../assets/pancito-sprite-set-transparente.webp";
import { CargaContext } from "./carga";

// Lo que tarda el telón en subir y en irse: los mismos tiempos de las
// transiciones de `.carga` en index.css. Si cambia uno, cambia el otro.
const ENTRADA_MS = 320;
const SALIDA_MS = 380;
const ESPERA_MS = 1400;

// La pantalla de carga de la app de comandas: el pancito de la web, que sale
// al entrar. Se usa como transición: se pide con `cubrir`, se espera a que
// tape la pantalla y entonces se cambia de página; ella sola se va al rato.
//
//   await cubrir("Abriendo comandas…");
//   navigate("/mesas");
export const CargaProvider = ({ children }) => {
  const [carga, setCarga] = useState(null);
  // La promesa de la que está puesta, para no apilar dos.
  const actual = useRef(null);

  // La hoja de cuadros se pide al abrir la app, para que el pancito ya esté
  // listo cuando haga falta.
  useEffect(() => {
    new Image().src = hojaPancito;
  }, []);

  /**
   * Pone la pantalla de carga. La promesa se cumple cuando ya tapa todo.
   * Si ya hay una puesta, devuelve esa misma.
   *
   * @param mensaje Qué se está esperando.
   * @param opciones.inmediata Debajo aún no hay nada pintado: aparece puesta, sin subir.
   * @param opciones.espera Milisegundos que se queda después de cubrir.
   */
  const cubrir = useCallback((mensaje, { inmediata = false, espera = ESPERA_MS } = {}) => {
    if (actual.current) return actual.current;

    const entrada = inmediata ? 0 : ENTRADA_MS;
    actual.current = new Promise((resolver) => setTimeout(resolver, entrada));
    setCarga({ mensaje, inmediata, saliendo: false });
    setTimeout(() => setCarga((c) => c && { ...c, saliendo: true }), entrada + espera);
    setTimeout(() => {
      actual.current = null;
      setCarga(null);
    }, entrada + espera + SALIDA_MS);
    return actual.current;
  }, []);

  return (
    <CargaContext.Provider value={cubrir}>
      {children}
      {carga && <PantallaCarga mensaje={carga.mensaje} inmediata={carga.inmediata} saliendo={carga.saliendo} />}
    </CargaContext.Provider>
  );
};
