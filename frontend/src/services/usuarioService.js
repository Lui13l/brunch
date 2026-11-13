import { api } from "../api/api";

export const actualizarPerfil = (datos) =>
  api.put("/usuarios/perfil", datos);