// Dirección del backend. En desarrollo queda vacía y las rutas "/api" y "/ws"
// pasan por el proxy de Vite (vite.config.js). En producción (Vercel) no hay
// proxy: VITE_BACKEND_URL apunta al backend, por ejemplo https://brunch-api.onrender.com.
const ORIGEN_BACKEND = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

// "/api/…" -> dirección completa del backend. Lo demás (una foto de otra web) queda igual.
export const urlApi = (ruta) => (ruta?.startsWith("/api/") ? `${ORIGEN_BACKEND}${ruta}` : ruta);

// El WebSocket va al mismo backend: https -> wss, http -> ws.
export const urlWs = (ruta = "/ws") => {
  if (ORIGEN_BACKEND) return `${ORIGEN_BACKEND.replace(/^http/, "ws")}${ruta}`;
  const protocolo = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocolo}//${window.location.host}${ruta}`;
};
