import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import PantallaCarga from "../components/PantallaCarga";
import hojaPancito from "../assets/pancito-sprite-set-transparente.webp";

const CargaContext = createContext(null);

// Si la animación no avisa (pestaña en segundo plano, un error), nadie se
// queda esperando ni con la pantalla tapada para siempre.
const MAXIMO_PARA_CUBRIR = 1500;
const MAXIMO_EN_PANTALLA = 6000;

// La pantalla de carga de toda la web. Se usa como transición: se pide con
// `cubrir`, se espera a que tape la página y entonces se cambia de página;
// ella sola se va al rato.
//
//   await cubrir("Preparando tu mesa…");
//   navigate("/");
export const CargaProvider = ({ children }) => {
  const [carga, setCarga] = useState(null);
  // La que está en pantalla: su promesa, cómo resolverla y sus relojes de respaldo.
  const actual = useRef(null);

  // La hoja de cuadros se pide al abrir la web, para que el pancito ya esté
  // listo la primera vez que haga falta.
  useEffect(() => {
    new Image().src = hojaPancito;
  }, []);

  const terminar = useCallback(() => {
    if (!actual.current) return;
    clearTimeout(actual.current.relojCubrir);
    clearTimeout(actual.current.relojQuitar);
    actual.current.cubierta();
    actual.current = null;
    setCarga(null);
  }, []);

  /**
   * Pone la pantalla de carga. La promesa se cumple cuando ya tapa la página.
   * Si ya hay una puesta, devuelve esa misma: no se apilan.
   *
   * @param mensaje Qué se está esperando.
   * @param opciones.inmediata La página debajo ya está en blanco: aparece puesta, sin subir.
   * @param opciones.espera Segundos que se queda después de cubrir.
   */
  const cubrir = useCallback(
    (mensaje, { inmediata = false, espera = 0.9 } = {}) => {
      if (actual.current) return actual.current.promesa;

      let cubierta;
      const promesa = new Promise((resolver) => {
        cubierta = resolver;
      });
      actual.current = {
        promesa,
        cubierta,
        relojCubrir: setTimeout(cubierta, MAXIMO_PARA_CUBRIR),
        relojQuitar: setTimeout(terminar, MAXIMO_EN_PANTALLA),
      };
      setCarga({ mensaje, inmediata, espera });
      return promesa;
    },
    [terminar],
  );

  return (
    <CargaContext.Provider value={{ cubrir, cargando: Boolean(carga) }}>
      {children}
      {carga && (
        <PantallaCarga
          mensaje={carga.mensaje}
          inmediata={carga.inmediata}
          espera={carga.espera}
          onCubierta={() => actual.current?.cubierta()}
          onTerminada={terminar}
        />
      )}
    </CargaContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePantallaCarga = () => useContext(CargaContext);
