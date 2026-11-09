import { api } from "../api/api";

// Pedidos web del cliente.
export const crearPedido = (datos) => api.post("/pedidos", datos);
export const misPedidos = () => api.get("/pedidos/mis-pedidos");
export const obtenerPedido = (id) => api.get(`/pedidos/${id}`);

export const crearPago = (pedidoId, metodo) => api.post("/pagos", { pedido_id: pedidoId, metodo });
