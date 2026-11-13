import { useNavigate } from "react-router-dom";
import { Check, Clock } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "./Exito.css";

const PedidoExitoso = () => {
  const navigate = useNavigate();

  return (
    <>
      <Navbar />

      <main className="exito-main">
        <div className="exito-card tarjeta entrada-pagina">
          <span className="exito-icon" aria-hidden="true">
            <Check size={32} strokeWidth={2.2} />
          </span>

          <h1 className="exito-title">¡En camino!</h1>

          <p className="exito-sub">
            Tu pedido ha sido recibido con éxito. Nuestro equipo lo está
            preparando con todo el cariño para que llegue fresquito a tu puerta.
          </p>

          <p className="exito-detalle">
            <Clock size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>
              Tiempo estimado de entrega: <strong>30 – 45 min</strong>
            </span>
          </p>

          <div className="exito-actions">
            <button type="button" className="boton boton--primario" onClick={() => navigate("/")}>
              Volver al inicio
            </button>
            <button type="button" className="boton boton--secundario" onClick={() => navigate("/menu")}>
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
