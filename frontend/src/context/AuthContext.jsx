import { createContext, useContext, useEffect, useState } from "react";
import { getToken, setToken } from "../api/api";
import * as authService from "../api/authService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(() => Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;

    authService.obtenerPerfil()
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
    iniciarSesion(await authService.login(correo, password));

  const loginWithGoogle = async (credential) =>
    iniciarSesion(await authService.loginGoogle(credential));

  const register = async (datos) =>
    iniciarSesion(await authService.registro(datos));

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        cargando,
        login,
        loginWithGoogle,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);