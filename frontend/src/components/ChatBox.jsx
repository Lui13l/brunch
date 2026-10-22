import { useState, useRef, useEffect } from "react";
import { api } from "../api";
import "./ChatBox.css";

const WELCOME = {
  from: "bot",
  text: "¡Hola! 👋 Soy el asistente de Brunch & Co. Pregúntame sobre nuestro menú, horarios, reservas, pagos o el estado de tu pedido.",
};

// Las respuestas vienen del chatbot del backend (POST /api/chat/mensaje).
// Con sesión iniciada la conversación se guarda y puede consultar tus pedidos y reservas.
const ChatBox = () => {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef(null);

  useEffect(() => {
    // Se desplaza solo dentro del chat, sin mover toda la página.
    const lista = messagesRef.current;
    if (lista) lista.scrollTo({ top: lista.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { from: "user", text }]);
    setLoading(true);

    try {
      const { respuesta } = await api.post("/chat/mensaje", { mensaje: text });
      setMessages((prev) => [...prev, { from: "bot", text: respuesta }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: err.status === 429 ? err.message : "Ahora mismo no puedo responder. Inténtalo de nuevo en un momento." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  return (
    <div className="chatbox">
      <div className="chatbox-messages" ref={messagesRef} aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`chatbox-bubble chatbox-bubble--${m.from}`}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="chatbox-bubble chatbox-bubble--bot chatbox-typing">
            <span /><span /><span />
          </div>
        )}
      </div>

      <div className="chatbox-input-row">
        <input
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
          className="chatbox-send"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default ChatBox;
