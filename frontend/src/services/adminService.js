import { api, getToken } from "../api/api";

// Llamadas del panel de administración de la web. Las rutas /admin/* son las
// mismas que usa la app de comandas (camelCase, errores en texto plano).

const qs = (filtros = {}) => {
  const p = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== "" && v != null));
  const s = p.toString();
  return s ? `?${s}` : "";
};

// Carta (platos) con lo que ve la web y el salón; queda en la auditoría.
export const listarPlatos = () => api.get("/admin/menu");
export const crearPlato = (datos) => api.post("/admin/menu", datos);
export const editarPlato = (id, datos) => api.put(`/admin/menu/${id}`, datos);
export const eliminarPlato = (id) => api.delete(`/admin/menu/${id}`);

export const listarCategorias = () => api.get("/categorias");
export const crearCategoria = (datos) => api.post("/categorias", datos);
export const editarCategoria = (id, datos) => api.put(`/categorias/${id}`, datos);
export const eliminarCategoria = (id) => api.delete(`/categorias/${id}`);

export const listarPedidos = (filtros) => api.get(`/admin/pedidos${qs(filtros)}`);
export const cambiarEstadoPedido = (id, estado) => api.patch(`/admin/pedidos/${id}/estado`, { estado });
export const asignarDomiciliario = (id, domiciliarioId) =>
  api.patch(`/pedidos/${id}/domiciliario`, { domiciliario_id: domiciliarioId });

export const listarReservas = (filtros) => api.get(`/reservas${qs(filtros)}`);
export const cambiarEstadoReserva = (id, estado) => api.patch(`/reservas/${id}/estado`, { estado });

export const listarPagos = (filtros) => api.get(`/pagos${qs(filtros)}`);
export const cambiarEstadoPago = (id, estado) => api.patch(`/pagos/${id}/estado`, { estado });

export const listarDomiciliarios = (filtros) => api.get(`/domiciliarios${qs(filtros)}`);
export const crearDomiciliario = (datos) => api.post("/domiciliarios", datos);
export const editarDomiciliario = (id, datos) => api.put(`/domiciliarios/${id}`, datos);
export const cambiarEstadoDomiciliario = (id, estado) => api.patch(`/domiciliarios/${id}/estado`, { estado });

export const listarUsuarios = (filtros) => api.get(`/usuarios${qs(filtros)}`);
export const cambiarRolUsuario = (id, rolId) => api.patch(`/usuarios/${id}/rol`, { rol_id: rolId });
export const cambiarActivoUsuario = (id, activo) => api.patch(`/admin/personal/${id}/activo`, { activo });

export const listarIntenciones = () => api.get("/chat/intenciones");
export const crearIntencion = (datos) => api.post("/chat/intenciones", datos);
export const editarIntencion = (id, datos) => api.put(`/chat/intenciones/${id}`, datos);
export const eliminarIntencion = (id) => api.delete(`/chat/intenciones/${id}`);

export const listarAuditoria = (filtros) => api.get(`/admin/auditoria${qs(filtros)}`);

// App de comandas (personal): se abre con la sesión de la web ya iniciada. El
// token va en el fragmento (#), que el navegador no envía al servidor.
const URL_COMANDAS = import.meta.env.VITE_PERSONAL_URL || "http://localhost:5174";
export const abrirComandas = () => {
  const token = getToken();
  const url = `${URL_COMANDAS.replace(/\/$/, "")}/entrar${token ? `#token=${encodeURIComponent(token)}` : ""}`;
  window.open(url, "_blank", "noopener");
};
