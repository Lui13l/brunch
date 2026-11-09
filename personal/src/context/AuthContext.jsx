import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SesionContext } from "./sesion";

// Claves propias: esta app y la web del restaurante son orígenes distintos y
// cada quien inicia sesión en su dispositivo.
const USER_KEY = "brunch_staff_user";
const TOKEN_KEY = "brunch_staff_token";

const tokenExpirado = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

const leerSesion = () => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = JSON.parse(localStorage.getItem(USER_KEY));
    if (token && user && !tokenExpirado(token)) return { token, user };
  } catch {
    // sesión corrupta: se descarta
  }
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  return { token: null, user: null };
};

export const AuthProvider = ({ children }) => {
  const [sesion, setSesion] = useState(leerSesion);
  const { user, token } = sesion;

  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (user && token) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [user, token]);

  // Por qué se cerró la sesión sin que el usuario lo pidiera (se muestra en el login).
  const [motivo, setMotivo] = useState("");

  const logout = useCallback((razon) => {
    setMotivo(typeof razon === "string" ? razon : "");
    setSesion({ user: null, token: null });
  }, []);

  // El servidor corta el tiempo real cuando la cuenta se desactiva o cambia de rol.
  useEffect(() => {
    const alCerrar = (e) =>
      logout(
        e.detail?.code === 4403
          ? "Tu rol cambió. Vuelve a iniciar sesión."
          : "Tu sesión se cerró: la cuenta cambió o fue desactivada."
      );
    window.addEventListener("brunch:sesion-cerrada", alCerrar);
    return () => window.removeEventListener("brunch:sesion-cerrada", alCerrar);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    try {
      const res = await fetch("/api/usuarios/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      // Solo un 401 son credenciales malas; lo demás es un problema del
      // servidor y decirlo así ahorra buscar donde no es.
      if (res.status === 401) return { ok: false, error: "Correo o contraseña incorrectos." };
      // Demasiados intentos: el servidor explica cuánto esperar.
      if (res.status === 429) return { ok: false, error: (await res.text()) || "Demasiados intentos. Espera unos minutos." };
      if (!res.ok) return { ok: false, error: "No se pudo conectar con el servidor. ¿Está abierta la aplicación del salón?" };

      const data = await res.json();
      // El 2FA es para los clientes de la web; el personal no lo usa.
      if (data.requiere2fa) {
        return { ok: false, error: "Esta cuenta tiene verificación en dos pasos. Desactívala para usar comandas." };
      }
      if (data.rol === "USUARIO") {
        return { ok: false, error: "Esta cuenta es de cliente, no del personal del restaurante." };
      }

      const { token: nuevoToken, ...usuario } = data;
      setMotivo("");
      setSesion({ user: usuario, token: nuevoToken });
      return { ok: true, rol: usuario.rol };
    } catch {
      return { ok: false, error: "No se pudo conectar con el servidor." };
    }
  }, []);

  // Sesión abierta desde el panel de admin de la web: llega su token y se
  // pregunta al servidor quién es (y si de verdad es personal del restaurante).
  const entrarConToken = useCallback(async (nuevoToken) => {
    try {
      const res = await fetch("/api/usuarios/yo", { headers: { Authorization: `Bearer ${nuevoToken}` } });
      if (!res.ok) return { ok: false, error: "La sesión de la web ya no es válida. Entra con tu correo." };
      const usuario = await res.json();
      if (usuario.rol === "USUARIO") {
        return { ok: false, error: "Esta cuenta es de cliente, no del personal del restaurante." };
      }
      setMotivo("");
      setSesion({ user: usuario, token: nuevoToken });
      return { ok: true, rol: usuario.rol };
    } catch {
      return { ok: false, error: "No se pudo conectar con el servidor." };
    }
  }, []);

  // Inyecta el token y cierra sesión si el servidor dice que ya no vale.
  const authFetch = useCallback(
    async (url, options = {}) => {
      const actual = tokenRef.current;
      const headers = new Headers(options.headers);
      if (actual) headers.set("Authorization", `Bearer ${actual}`);
      if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

      const res = await fetch(url, { ...options, headers });
      if (res.status === 401 && actual) logout("Tu sesión expiró o fue cerrada. Vuelve a entrar.");
      return res;
    },
    [logout],
  );

  // Los errores de la API llegan como texto plano, listos para mostrar.
  const pedir = useCallback(
    async (url, options) => {
      const res = await authFetch(url, options);
      if (!res.ok) throw new Error((await res.text()) || "Algo salió mal");
      return res.status === 204 ? null : res.json();
    },
    [authFetch],
  );

  const value = useMemo(
    () => ({ user, token, motivo, login, entrarConToken, logout, authFetch, pedir }),
    [user, token, motivo, login, entrarConToken, logout, authFetch, pedir],
  );

  return <SesionContext.Provider value={value}>{children}</SesionContext.Provider>;
};
