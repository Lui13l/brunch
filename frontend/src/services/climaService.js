import { api } from "../api/api";

// El clima lo pide el backend (ahí vive la clave de OpenWeather). Responde
// { temperatura, descripcion, tipo } o null si no hay datos.
export const obtenerClima = () => api.get("/clima");
