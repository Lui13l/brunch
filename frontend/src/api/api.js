// Cliente de la API del backend. La URL se configura con VITE_API_URL (ver .env.example).
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const TOKEN_KEY = "brunch_token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sin localStorage (modo privado estricto) la sesión dura hasta recargar.
  }
};

export class ApiError extends Error {
  constructor(status, mensaje, errores) {
    super(mensaje);
    this.status = status;
    this.errores = errores;
  }
}

const request = async (method, path, body) => {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. Inténtalo de nuevo en un momento.");
  }

  if (res.status === 204) return null;
  // Las rutas de la web responden JSON; las de administración (/admin, comandas)
  // responden los errores en texto plano.
  const texto = await res.text();
  let data = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    // Los errores de validación traen el detalle en "errores".
    const detalle = data?.errores?.length ? `: ${data.errores.join(", ")}` : "";
    const mensaje = data?.mensaje || (data === null && texto) || "Error inesperado";
    throw new ApiError(res.status, `${mensaje}${detalle}`, data?.errores);
  }
  return data;
};

export const api = {
  get: (path) => request("GET", path),
  post: (path, body = {}) => request("POST", path, body),
  put: (path, body = {}) => request("PUT", path, body),
  patch: (path, body = {}) => request("PATCH", path, body),
  delete: (path) => request("DELETE", path),
};

export const formatearPrecio = (valor) => `$${Number(valor).toLocaleString("es-CO")}`;
