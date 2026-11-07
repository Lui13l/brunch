import { useEffect, useRef, useState } from "react";

/**
 * Cliente WebSocket con protocolo JSON por topic.
 *
 * Copia adaptada del hook de brunchie_design (solo cambia la clave del token).
 * Si alguna vez las dos versiones divergen de verdad, toca extraerlo a un
 * paquete compartido; por ahora duplicar dos archivos cuesta menos que montar
 * workspaces de npm.
 *
 * Una sola conexión compartida por toda la app, con conteo de referencias por
 * topic: se abre con el primer topic y se cierra cuando ya nadie escucha.
 *
 * Protocolo: {type:"auth"|"subscribe"|"unsubscribe"|"ping"} hacia el servidor,
 * {type:"ready"|"subscribed"|"message"|"pong"|"error"} de vuelta.
 */

const RECONEXION_MS = [1000, 2000, 5000];

const listeners = new Map(); // topic -> Set<callback>
const estadoListeners = new Set(); // callbacks que siguen el estado de conexión

let socket = null;
let autenticado = false;
let intentos = 0;
let reintento = null;
let cierrePendiente = null;

const topicsActivos = () => [...listeners.keys()];
const avisarEstado = (conectado) => estadoListeners.forEach((fn) => fn(conectado));
const enviar = (payload) => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify(payload));

function programarReconexion() {
  if (reintento || topicsActivos().length === 0) return;
  const espera = RECONEXION_MS[Math.min(intentos, RECONEXION_MS.length - 1)];
  intentos += 1;
  reintento = setTimeout(() => {
    reintento = null;
    conectar();
  }, espera);
}

function conectar() {
  if (socket || topicsActivos().length === 0) return;

  const token = localStorage.getItem("brunch_staff_token");
  if (!token) return; // sin sesión no hay nada que escuchar

  const protocolo = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocolo}//${window.location.host}/ws`);

  socket.addEventListener("open", () => {
    autenticado = false;
    enviar({ type: "auth", token });
  });

  socket.addEventListener("message", (event) => {
    let mensaje;
    try {
      mensaje = JSON.parse(event.data);
    } catch {
      return;
    }

    if (mensaje.type === "ready") {
      autenticado = true;
      intentos = 0;
      enviar({ type: "subscribe", topics: topicsActivos() });
      avisarEstado(true);
      return;
    }
    if (mensaje.type === "message") {
      listeners.get(mensaje.topic)?.forEach((fn) => fn(mensaje.topic, mensaje.data));
      return;
    }
    if (mensaje.type === "error" && !autenticado) {
      console.warn("WebSocket:", mensaje.message);
    }
  });

  socket.addEventListener("close", (evento) => {
    socket = null;
    autenticado = false;
    avisarEstado(false);
    // 4401: la sesión ya no vale (cuenta desactivada, token revocado).
    // 4403: cambió el rol. En ambos casos reconectar no sirve: hay que volver a entrar.
    if (evento.code === 4401 || evento.code === 4403) {
      window.dispatchEvent(new CustomEvent("brunch:sesion-cerrada", { detail: { code: evento.code } }));
      return;
    }
    programarReconexion();
  });

  socket.addEventListener("error", () => socket?.close());
}

function suscribir(topic, callback) {
  clearTimeout(cierrePendiente);
  cierrePendiente = null;

  const nuevo = !listeners.has(topic);
  if (nuevo) listeners.set(topic, new Set());
  listeners.get(topic).add(callback);

  if (!socket) conectar();
  else if (autenticado && nuevo) enviar({ type: "subscribe", topics: [topic] });
}

function desuscribir(topic, callback) {
  const callbacks = listeners.get(topic);
  if (!callbacks) return;

  callbacks.delete(callback);
  if (callbacks.size > 0) return;

  listeners.delete(topic);
  enviar({ type: "unsubscribe", topics: [topic] });

  // Margen antes de cerrar: en desarrollo React monta, desmonta y vuelve a
  // montar los efectos, y cerrar un socket a medio abrir ensucia la consola.
  if (topicsActivos().length === 0 && !cierrePendiente) {
    cierrePendiente = setTimeout(() => {
      cierrePendiente = null;
      if (topicsActivos().length > 0) return;
      clearTimeout(reintento);
      reintento = null;
      socket?.close();
      socket = null;
    }, 500);
  }
}

/**
 * @param {string} wsPath  Ruta del WebSocket (hoy siempre "/ws").
 * @param {string[]} topics Topics a escuchar.
 * @param {(topic: string, data: any) => void} onMessage
 * @returns {boolean} si la conexión está lista
 */
export const useWebSocket = (wsPath, topics, onMessage) => {
  const [conectado, setConectado] = useState(autenticado);
  const topicsKey = JSON.stringify(topics ?? []);

  // El callback se lee de la ref en cada mensaje, así cambiarlo no re-suscribe.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    estadoListeners.add(setConectado);
    return () => estadoListeners.delete(setConectado);
  }, []);

  useEffect(() => {
    const lista = JSON.parse(topicsKey);
    if (!wsPath || lista.length === 0) return;

    const handler = (topic, data) => onMessageRef.current(topic, data);
    lista.forEach((topic) => suscribir(topic, handler));
    return () => lista.forEach((topic) => desuscribir(topic, handler));
  }, [wsPath, topicsKey]);

  return conectado;
};
