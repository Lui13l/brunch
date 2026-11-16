import { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { useChat } from "../context/ChatContext";
import "./ChatBox.css";

// La conversación (mensajes, sugerencias y envío) vive en ChatContext: este
// componente solo la dibuja, así que se puede poner en varios sitios a la vez.
// `enfocar`: el campo toma el foco al aparecer (el chat flotante recién abierto).
const ChatBox = ({ enfocar = false }) => {
  const { mensajes, escribiendo, sugerencias, enviar } = useChat();
  const [input, setInput] = useState("");
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Se desplaza solo dentro del chat, sin mover toda la página.
    const lista = messagesRef.current;
    if (lista) lista.scrollTo({ top: lista.scrollHeight, behavior: "smooth" });
  }, [mensajes, escribiendo]);

  useEffect(() => {
    if (enfocar) inputRef.current?.focus({ preventScroll: true });
  }, [enfocar]);

  const send = async (textoDirecto) => {
    const text = (textoDirecto ?? input).trim();
    if (!text || escribiendo) return;
    setInput("");
    await enviar(text);
    // El campo se desactiva mientras responde: al terminar recupera el foco para seguir escribiendo.
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const haySugerencias = !escribiendo && sugerencias.length > 0;

  return (
    <div className="chatbox">
      <div className="chatbox-messages" ref={messagesRef} aria-live="polite">
        {mensajes.map((m, i) => (
          <div key={i} className={`chatbox-bubble chatbox-bubble--${m.from}`}>
            {m.text}
          </div>
        ))}
        {escribiendo && (
          <div className="chatbox-bubble chatbox-bubble--bot chatbox-typing" aria-label="El asistente está escribiendo">
            <span /><span /><span />
          </div>
        )}
        {haySugerencias && (
          <div className="chatbox-sugerencias">
            {sugerencias.map((pregunta) => (
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
          disabled={escribiendo}
        />
        <button
          type="button"
          className="chatbox-send"
          onClick={() => void send()}
          disabled={escribiendo || !input.trim()}
          aria-label="Enviar mensaje"
        >
          <ArrowUp size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default ChatBox;
