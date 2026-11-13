import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/sesion";
import { INICIO_POR_ROL } from "../lib/formato";
import { Cargando } from "../components/ui";

// Entrada desde el panel de admin de la web: /entrar#token=...
// El token viaja en el fragmento (#), que el navegador nunca envía al servidor,
// y se borra de la barra de direcciones apenas se lee.
export default function Entrar() {
  const { entrarConToken, logout } = useAuth();
  const [destino, setDestino] = useState(null);
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;

    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(null, "", "/entrar");
    if (!token) {
      setDestino("/login");
      return;
    }
    entrarConToken(token).then((r) => {
      if (r.ok) {
        setDestino(INICIO_POR_ROL[r.rol] ?? "/mesas");
      } else {
        logout(r.error);
        setDestino("/login");
      }
    });
  }, [entrarConToken, logout]);

  if (destino) return <Navigate to={destino} replace />;
  return <Cargando texto="Abriendo comandas" />;
}
