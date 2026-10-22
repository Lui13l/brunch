import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "../api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Mientras se valida el token guardado no se sabe si hay sesión;
  // ProtectedRoute espera a que termine para no mandar al login por error.
  const [cargando, setCargando] = useState(() => Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api
      .get("/auth/perfil")
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = ({ token, usuario }) => {
    setToken(token);
    setUser(usuario);
    return usuario;
  };

  const login = async (correo, password) =>
    iniciarSesion(await api.post("/auth/login", { correo, password }));

  const register = async (datos) =>
    iniciarSesion(await api.post("/auth/registro", datos));

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, cargando, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Exportar el hook junto al provider es el patrón habitual; solo afecta a la recarga en caliente.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
