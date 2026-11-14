import { api } from "../api/api";

export const crearReserva = (datos) => api.post("/reservas", datos);
export const misReservas = () => api.get("/reservas/mis-reservas");
export const cancelarReserva = (id) => api.patch(`/reservas/${id}/cancelar`);
export const actualizarReserva = (id, datos) => api.patch(`/reservas/${id}`, datos);
