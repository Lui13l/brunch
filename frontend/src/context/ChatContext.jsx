import { createContext, useContext, useState } from "react";
import { enviarMensaje } from "../services/chatService";
import { useAuth } from "./AuthContext";

const ChatContext = createContext(null);

const BIENVENIDA = {
  from: "bot",
  text: "¡Hola! 👋 Soy el asistente de Brunch & Co. Pregúntame sobre nuestro menú, horarios, reservas, pagos o el estado de tu pedido.",
};

// Preguntas frecuentes para empezar sin tener que escribir. Después de cada
// respuesta, el asistente manda las suyas (o las opciones que pide contestar).
const SUGERENCIAS = ["¿Cuál es el horario?", "Quiero hacer una reserva", "¿Qué métodos de pago aceptan?"];

// La conversación con el asistente vive aquí y no en el componente: así es la
// misma en el chat flotante y en la página de contacto, y no se pierde al
// cambiar de página. Las respuestas vienen del chatbot del backend
// (POST /api/chat/mensaje); con sesión iniciada la conversación se guarda y
// puede consultar tus pedidos y reservas.
export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState([BIENVENIDA]);
  const [escribiendo, setEscribiendo] = useState(false);
  const [sugerencias, setSugerencias] = useState(SUGERENCIAS);
  const [abierto, setAbierto] = useState(false);

  // Al entrar o salir de la cuenta se empieza de cero: lo conversado puede
  // tener pedidos y reservas de quien estaba antes.
  const duenio = user?.id ?? user?._id ?? null;
  const [de, setDe] = useState(duenio);
  if (de !== duenio) {
    setDe(duenio);
    setMensajes([BIENVENIDA]);
    setSugerencias(SUGERENCIAS);
  }

  const enviar = async (texto) => {
    const text = texto.trim();
    if (!text || escribiendo) return;
    // Lo último que dijo el asistente (la bienvenida no cuenta: no vino de él).
    const anterior = mensajes.findLast((m) => m.from === "bot" && m !== BIENVENIDA)?.text;
    setMensajes((prev) => [...prev, { from: "user", text }]);
    setSugerencias([]);
    setEscribiendo(true);

    try {
      const { respuesta, sugerencias: nuevas } = await enviarMensaje(text, anterior);
      setMensajes((prev) => [...prev, { from: "bot", text: respuesta }]);
      setSugerencias(nuevas ?? []);
    } catch (err) {
      setMensajes((prev) => [
        ...prev,
        { from: "bot", text: err.status === 429 ? err.message : "Ahora mismo no puedo responder. Inténtalo de nuevo en un momento." },
      ]);
    } finally {
      setEscribiendo(false);
    }
  };

  return (
    <ChatContext.Provider value={{ mensajes, escribiendo, sugerencias, enviar, abierto, setAbierto }}>
      {children}
    </ChatContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useChat = () => useContext(ChatContext);
