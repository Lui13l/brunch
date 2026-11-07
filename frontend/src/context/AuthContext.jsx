
import { createContext, useContext, useEffect, useState } from "react";
import { getToken, setToken } from "../api/api";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(() => Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) {
      setCargando(false);
      return;
    }

    authService.getProfile()
      .then(setUser)
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = ({ token, usuario }) => {
    setToken(token);
    setUser(usuario);
    return usuario;
  };

  // Inicio de sesión tradicional
  const login = async (correo, password) => {
    const respuesta = await authService.login(correo, password);
    return iniciarSesion(respuesta);
  };

  // Registro
  const register = async (datos) => {
    const respuesta = await authService.register(datos);
    return iniciarSesion(respuesta);
  };

  // Inicio de sesión con Google
  const loginWithGoogle = async (credential) => {
    const respuesta = await authService.loginWithGoogle(credential);
    return iniciarSesion(respuesta);
  };

  // Cerrar sesión
  const logout = async () => {
    try {
      if (getToken()) {
        await authService.logout();
      }
    } finally {
      setToken(null);
      setUser(null);
    }
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

// Exportar el hook junto al provider es el patrón habitual; solo afecta a la recarga en caliente.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
