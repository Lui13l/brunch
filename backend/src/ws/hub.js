// Registro de suscripciones en memoria (una sola instancia del backend).
// publicar() es seguro aunque no haya servidor WebSocket: no envía nada.
const HEX = "[a-f\\d]{24}";
const MESERO_RE = new RegExp(`^/topic/mesero/(${HEX})/comandas$`, "i");
const USUARIO_RE = new RegExp(`^/topic/usuario/(${HEX})/pedido$`, "i");

const TOPICS = {
  salon: "/topic/salon",
  cocina: "/topic/cocina",
  adminCaja: "/topic/admin/caja",
  adminInventario: "/topic/admin/inventario",
  adminPedidos: "/topic/admin/pedidos",
  adminPedidosEstado: "/topic/admin/pedidos/estado",
  mesero: (id) => `/topic/mesero/${id}/comandas`,
  usuario: (id) => `/topic/usuario/${id}/pedido`,
};

const mismoId = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

const puedeSuscribirse = (user, topic) => {
  if (!user || typeof topic !== "string") return false;
  const { id, rol } = user;
  if (topic.startsWith("/topic/admin/")) return rol === "admin";
  if (topic === TOPICS.cocina) return rol === "cocina" || rol === "admin";
  if (topic === TOPICS.salon) return ["mesero", "cocina", "admin"].includes(rol);
  const m = topic.match(MESERO_RE);
  if (m) return rol === "admin" || mismoId(m[1], id);
  const u = topic.match(USUARIO_RE);
  if (u) return mismoId(u[1], id);
  return false;
};

const suscripciones = new Map(); // topic -> Set<ws>
const conectados = new Set(); // sockets autenticados

const suscribir = (ws, topic) => {
  if (!suscripciones.has(topic)) suscripciones.set(topic, new Set());
  suscripciones.get(topic).add(ws);
  ws.topics?.add(topic);
};

const desuscribir = (ws, topic) => {
  const set = suscripciones.get(topic);
  set?.delete(ws);
  if (set && set.size === 0) suscripciones.delete(topic);
  ws.topics?.delete(topic);
};

const eliminarCliente = (ws) => {
  for (const topic of [...(ws.topics || [])]) desuscribir(ws, topic);
  conectados.delete(ws);
};

const ABIERTO = 1;

const publicar = (topic, data) => {
  const clientes = suscripciones.get(topic);
  if (!clientes?.size) return;
  const mensaje = JSON.stringify({ type: "message", topic, data });
  for (const ws of clientes) {
    if (ws.readyState === ABIERTO) ws.send(mensaje);
  }
};

// 4401: la sesión ya no vale (token revocado, cuenta desactivada).
// 4403: cambió el rol; la app debe volver a iniciar sesión.
const desconectarUsuario = (usuarioId, code = 4401, motivo = "Sesión cerrada") => {
  for (const ws of conectados) {
    if (ws.user && mismoId(ws.user.id, usuarioId)) ws.close(code, motivo);
  }
};

const desconectarToken = (tokenHash) => {
  for (const ws of conectados) {
    if (ws.tokenHash === tokenHash) ws.close(4401, "Sesión cerrada");
  }
};

module.exports = {
  TOPICS,
  puedeSuscribirse,
  suscribir,
  desuscribir,
  eliminarCliente,
  publicar,
  conectados,
  desconectarUsuario,
  desconectarToken,
};
