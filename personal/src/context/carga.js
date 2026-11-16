import { createContext, useContext } from "react";

// El contexto y su hook viven aparte del proveedor (CargaContext.jsx), igual
// que la sesión: así la recarga en caliente funciona.
export const CargaContext = createContext(null);

export const usePantallaCarga = () => useContext(CargaContext);
