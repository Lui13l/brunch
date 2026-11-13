import { api } from "../api/api";

// Carta pública (solo lo activo y visible en la web).
export const listarProductos = () => api.get("/productos");
