import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "./PedidoExitoso.css";

const PedidoExitoso = () => {
  const navigate = useNavigate();

  return (
    <>
      <Navbar />

      <main className="pedido-main">
        <div className="pedido-card">
          <div className="pedido-icon">✓</div>

          <span className="pedido-eyebrow">Pedido confirmado</span>
          <h1 className="pedido-title">¡En camino!</h1>

          <div className="pedido-divider">
            <span className="pedido-divider-line" />
            <span className="pedido-divider-gem">✦</span>
            <span className="pedido-divider-line" />
          </div>

          <p className="pedido-sub">
            Tu pedido ha sido recibido con éxito. Nuestro equipo lo está
            preparando con todo el cariño para que llegue fresquito a tu puerta.
          </p>

          <div className="pedido-eta">
            <span className="pedido-eta-label">Tiempo estimado de entrega</span>
            <span className="pedido-eta-time">30 – 45 min</span>
          </div>

          <div className="pedido-actions">
            <button className="pedido-btn-primary" onClick={() => navigate("/")}>
              Volver al inicio
            </button>
            <button className="pedido-btn-secondary" onClick={() => navigate("/menu")}>
              Hacer otro pedido
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default PedidoExitoso;
