
import { api } from "../api/api";

export const authService = {
  login: (correo, password) =>
    api.post("/auth/login", { correo, password }),

  register: (datos) =>
    api.post("/auth/registro", datos),

  loginWithGoogle: (credential) =>
    api.post("/auth/google", { credential }),

  getProfile: () =>
    api.get("/auth/perfil"),

  logout: () =>
    api.post("/auth/logout"),
};
