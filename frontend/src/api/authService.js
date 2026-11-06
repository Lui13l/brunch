import { api } from "./api";

export const login = (correo, password) =>
  api.post("/auth/login", { correo, password });

export const loginGoogle = (credential) =>
  api.post("/auth/google", { credential });

export const registro = (datos) =>
  api.post("/auth/registro", datos);

export const obtenerPerfil = () =>
  api.get("/auth/perfil");

export const cerrarSesion = () =>
  api.post("/auth/logout");