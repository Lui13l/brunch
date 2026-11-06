import { api } from "./api";

export const actualizarPerfil = (datos) =>
  api.put("/usuarios/perfil", datos);