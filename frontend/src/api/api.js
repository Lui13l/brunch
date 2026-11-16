// Cliente de la API del backend. La URL se configura con VITE_API_URL (ver .env.example).
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// Origen del backend, sin "/api": las fotos subidas llegan como "/api/imagenes/…".
export const ORIGEN_API = API_URL.replace(/\/api\/?$/, "");

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
  // Un archivo (Blob) viaja tal cual, con su propio tipo; lo demás va como JSON.
  const archivo = body instanceof Blob;
  if (body !== undefined) headers["Content-Type"] = archivo ? body.type : "application/json";

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined || archivo ? body : JSON.stringify(body),
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

// Descarga un archivo que pide sesión (un PDF). Un enlace normal no manda el
// token, así que se pide con fetch y se devuelve como Blob.
const descargar = async (path) => {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. Inténtalo de nuevo en un momento.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.mensaje || "No se pudo descargar el archivo");
  }
  return res.blob();
};

export const api = {
  descargar,
  get: (path) => request("GET", path),
  post: (path, body = {}) => request("POST", path, body),
  put: (path, body = {}) => request("PUT", path, body),
  patch: (path, body = {}) => request("PATCH", path, body),
  delete: (path) => request("DELETE", path),
  subir: (path, archivo) => request("POST", path, archivo),
};

