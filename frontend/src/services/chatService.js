import { api } from "../api/api";

// `anterior` es lo último que dijo el asistente: sin sesión el backend no guarda
// la conversación y lo necesita para no repetir la misma respuesta.
export const enviarMensaje = (mensaje, anterior) => api.post("/chat/mensaje", { mensaje, anterior });
