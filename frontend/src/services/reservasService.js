import { api } from "../api/api";

export const crearReserva = (datos) => api.post("/reservas", datos);
export const misReservas = () => api.get("/reservas/mis-reservas");
