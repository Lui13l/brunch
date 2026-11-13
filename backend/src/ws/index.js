const { WebSocketServer } = require("ws");
const { cargarUsuario } = require("../middleware/auth");
const { hashToken } = require("../utils/authToken");
const hub = require("./hub");

const RUTA = "/ws";
const HEARTBEAT_MS = 30_000;
const AUTH_TIMEOUT_MS = 5_000;
const MAX_TOPICS = 20;

// Protocolo (JSON, un mensaje por frame), igual que la API anterior:
//   cliente  -> {type:"auth", token} | {type:"subscribe"|"unsubscribe", topics:[...]} | {type:"ping"}
//   servidor -> {type:"ready"} | {type:"subscribed", topics} | {type:"message", topic, data}
//               {type:"pong"} | {type:"error", message, topic?}
// El token va en el primer mensaje, no en la URL, para que no quede en logs.
// Cierres: 4401 sesión inválida/revocada/desactivada; 4403 cambió el rol.

// La app del personal en desarrollo (Vite, puerto 5174) siempre se acepta, para
// que funcione en cualquier PC del equipo sin tocar su .env.
const PERSONAL_LOCAL = ["http://localhost:5174", "http://127.0.0.1:5174"];

// Orígenes permitidos: WS_ORIGINS, o si no CORS_ORIGIN, más la app local del
// personal. Sin ninguna lista configurada se aceptan todos (como CORS).
const origenesPermitidos = () => {
  const lista = (process.env.WS_ORIGINS || process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return lista.length > 0 ? [...new Set([...lista, ...PERSONAL_LOCAL])] : [];
};

const enviar = (ws, payload) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
};

const autenticar = async (ws, token) => {
  // Un socket ya autenticado no cambia de identidad (conservaría sus temas).
  if (ws.user) {
    enviar(ws, { type: "error", message: "La conexión ya está autenticada" });
    return;
  }
  let usuario;
  let payload;
  try {
    if (typeof token !== "string" || !token) throw new Error("sin token");
    ({ usuario, payload } = await cargarUsuario(token));
  } catch {
    enviar(ws, { type: "error", message: "Sesión inválida o expirada" });
    ws.close(4401, "unauthorized");
    return;
  }
  ws.user = { id: String(usuario._id), rol: usuario.rol_id };
  ws.tokenHash = hashToken(token);
  clearTimeout(ws.authTimer);
  hub.conectados.add(ws);
  // Al vencer el token, el socket también se cierra.
  const restante = payload.exp * 1000 - Date.now();
  ws.expTimer = setTimeout(() => ws.close(4401, "token expirado"), Math.max(0, Math.min(restante, 2 ** 31 - 1)));
  ws.expTimer.unref?.();
  enviar(ws, { type: "ready" });
};

const cambiarSuscripciones = (ws, tipo, topics) => {
  if (!Array.isArray(topics)) {
    enviar(ws, { type: "error", message: "topics debe ser una lista" });
    return;
  }
  const aceptados = [];
  for (const topic of topics) {
    if (typeof topic !== "string") continue;
    if (tipo === "unsubscribe") {
      hub.desuscribir(ws, topic);
    } else if (ws.topics.size >= MAX_TOPICS && !ws.topics.has(topic)) {
      enviar(ws, { type: "error", topic, message: "Demasiadas suscripciones" });
    } else if (hub.puedeSuscribirse(ws.user, topic)) {
      hub.suscribir(ws, topic);
      aceptados.push(topic);
    } else {
      enviar(ws, { type: "error", topic, message: "No autorizado para este topic" });
    }
  }
  if (tipo === "subscribe") enviar(ws, { type: "subscribed", topics: aceptados });
};

const alRecibir = async (ws, raw) => {
  let mensaje;
  try {
    mensaje = JSON.parse(raw);
  } catch {
    enviar(ws, { type: "error", message: "Mensaje no es JSON válido" });
    return;
  }
  if (mensaje.type === "ping") return enviar(ws, { type: "pong" });
  if (mensaje.type === "auth") return autenticar(ws, mensaje.token);
  if (!ws.user) return enviar(ws, { type: "error", message: "Autentícate primero" });
  if (mensaje.type === "subscribe" || mensaje.type === "unsubscribe") {
    return cambiarSuscripciones(ws, mensaje.type, mensaje.topics);
  }
  return enviar(ws, { type: "error", message: `Tipo de mensaje desconocido: ${mensaje.type}` });
};

// Engancha el WebSocket al servidor HTTP. Devuelve una función para cerrarlo.
const adjuntarWebSocket = (server) => {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  const alActualizar = (req, socket, head) => {
    const { pathname } = new URL(req.url, "http://localhost");
    const origin = req.headers.origin;
    const permitidos = origenesPermitidos();
    if (pathname !== RUTA || (origin && permitidos.length > 0 && !permitidos.includes(origin))) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  };
  server.on("upgrade", alActualizar);

  wss.on("connection", (ws) => {
    ws.user = null;
    ws.topics = new Set();
    ws.isAlive = true;
    ws.authTimer = setTimeout(() => {
      if (!ws.user) ws.close(4401, "auth timeout");
    }, AUTH_TIMEOUT_MS);

    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.on("message", (raw) => {
      alRecibir(ws, raw.toString()).catch((err) => {
        console.error("Error en WebSocket:", err);
        enviar(ws, { type: "error", message: "Error interno" });
      });
    });
    ws.on("close", () => {
      clearTimeout(ws.authTimer);
      clearTimeout(ws.expTimer);
      hub.eliminarCliente(ws);
    });
  });

  // Los navegadores responden solos a los ping de protocolo.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  return () => {
    clearInterval(heartbeat);
    server.off("upgrade", alActualizar);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  };
};

module.exports = { adjuntarWebSocket };
