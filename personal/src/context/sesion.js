import { createContext, useContext } from "react";

// El contexto y su hook viven aparte del proveedor: así AuthContext.jsx solo
// exporta un componente y la recarga en caliente funciona.
export const SesionContext = createContext(null);

export const useAuth = () => useContext(SesionContext);
