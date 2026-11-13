import { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { enviarMensaje } from "../services/chatService";
import "./ChatBox.css";

const WELCOME = {
  from: "bot",
  text: "¡Hola! 👋 Soy el asistente de Brunch & Co. Pregúntame sobre nuestro menú, horarios, reservas, pagos o el estado de tu pedido.",
};

// Preguntas frecuentes para empezar sin tener que escribir.
const SUGERENCIAS = ["¿Cuál es el horario?", "Quiero hacer una reserva", "¿Qué métodos de pago aceptan?"];

// Las respuestas vienen del chatbot del backend (POST /api/chat/mensaje).
// Con sesión iniciada la conversación se guarda y puede consultar tus pedidos y reservas.
const ChatBox = () => {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Se desplaza solo dentro del chat, sin mover toda la página.
    const lista = messagesRef.current;
    if (lista) lista.scrollTo({ top: lista.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (textoDirecto) => {
    const text = (textoDirecto ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { from: "user", text }]);
    setLoading(true);

    try {
      const { respuesta } = await enviarMensaje(text);
      setMessages((prev) => [...prev, { from: "bot", text: respuesta }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: err.status === 429 ? err.message : "Ahora mismo no puedo responder. Inténtalo de nuevo en un momento." },
      ]);
    } finally {
      setLoading(false);
      // El campo se desactiva mientras responde: al terminar recupera el foco para seguir escribiendo.
      requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const soloBienvenida = messages.length === 1 && !loading;

  return (
    <div className="chatbox">
      <div className="chatbox-messages" ref={messagesRef} aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`chatbox-bubble chatbox-bubble--${m.from}`}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="chatbox-bubble chatbox-bubble--bot chatbox-typing" aria-label="El asistente está escribiendo">
            <span /><span /><span />
          </div>
        )}
        {soloBienvenida && (
          <div className="chatbox-sugerencias">
            {SUGERENCIAS.map((pregunta) => (
              <button key={pregunta} type="button" className="chatbox-sugerencia" onClick={() => void send(pregunta)}>
                {pregunta}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="chatbox-input-row">
        <input
          ref={inputRef}
          className="chatbox-input"
          type="text"
          placeholder="Escribe tu mensaje..."
          aria-label="Mensaje para el asistente"
          maxLength={500}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
        />
        <button
          type="button"
          className="chatbox-send"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          aria-label="Enviar mensaje"
        >
          <ArrowUp size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default ChatBox;
