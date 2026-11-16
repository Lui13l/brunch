import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { useChat } from "../context/ChatContext";
import ChatBox from "./ChatBox";
import "./ChatFlotante.css";

// Páginas donde el botón estorba o sobra: en contacto el chat ya está en la
// página, en el pago taparía "Confirmar pedido" y al entrar no hay con quién
// seguir la conversación todavía.
const SIN_CHAT = ["/contact", "/checkout", "/login"];

// El asistente a un clic desde cualquier página: un botón fijo sobre el del
// carrito que abre el chat en una ventana pequeña. La conversación es la misma
// de la página de contacto y sigue ahí al cambiar de página.
const ChatFlotante = () => {
  const { abierto, setAbierto } = useChat();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!abierto) return undefined;
    const alPulsar = (e) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierto, setAbierto]);

  if (pathname.startsWith("/admin") || SIN_CHAT.includes(pathname)) return null;

  return (
    <>
      {abierto && (
        <section id="chat-flotante" className="chat-flotante-panel" role="dialog" aria-label="Asistente de Brunch & Co.">
          <header className="chat-flotante-cabeza">
            <span className="chat-flotante-avatar" aria-hidden="true">B</span>
            <div className="chat-flotante-quien">
              <p className="chat-flotante-titulo">Asistente de Brunch & Co.</p>
              <p className="chat-flotante-estado">Responde al instante</p>
            </div>
            <button type="button" className="chat-flotante-cerrar" aria-label="Cerrar el chat" onClick={() => setAbierto(false)}>
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <ChatBox enfocar />
        </section>
      )}

      <button
        type="button"
        className={`chat-flotante-btn${abierto ? " chat-flotante-btn--abierto" : ""}`}
        aria-expanded={abierto}
        aria-controls="chat-flotante"
        aria-label={abierto ? "Cerrar el chat" : "Abrir el chat con el asistente"}
        title={abierto ? "Cerrar el chat" : "¿Te ayudamos? Escríbenos"}
        onClick={() => setAbierto(!abierto)}
      >
        {abierto ? <X size={22} strokeWidth={1.8} aria-hidden="true" /> : <MessageCircle size={22} strokeWidth={1.8} aria-hidden="true" />}
      </button>
    </>
  );
};

export default ChatFlotante;
