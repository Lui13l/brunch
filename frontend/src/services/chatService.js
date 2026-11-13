import { api } from "../api/api";

export const enviarMensaje = (mensaje) => api.post("/chat/mensaje", { mensaje });
