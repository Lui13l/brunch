import { useLocation, useNavigate } from "react-router-dom";
import { CalendarCheck, Check } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import "./Exito.css";

// "2026-10-25T00:00:00.000Z" -> "sábado, 25 de octubre"
const formatearDia = (iso) =>
  new Date(iso).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

const ReservaExitosa = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reserva = useLocation().state?.reserva;

  return (
    <>
      <Navbar />

      <main className="exito-main">
        <div className="exito-card tarjeta entrada-pagina">
          <span className="exito-icon" aria-hidden="true">
            <Check size={32} strokeWidth={2.2} />
          </span>

          <h1 className="exito-title">¡Todo listo, {user?.nombre?.split(" ")[0]}!</h1>

          <p className="exito-sub">
            Tu reserva ha sido recibida con éxito. Te avisaremos cuando quede confirmada.
            Te esperamos con los brazos abiertos y el mejor brunch de la ciudad.
          </p>

          {reserva && (
            <p className="exito-detalle">
              <CalendarCheck size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>
                <strong>{formatearDia(reserva.dia)}</strong> a las <strong>{reserva.hora}</strong>, {reserva.cupo}{" "}
                {reserva.cupo === 1 ? "persona" : "personas"}
                {reserva.ocasion && ` (${reserva.ocasion})`}
              </span>
            </p>
          )}

          <div className="exito-actions">
            <button type="button" className="boton boton--primario" onClick={() => navigate("/")}>
              Volver al inicio
            </button>
            <button type="button" className="boton boton--secundario" onClick={() => navigate("/menu")}>
              Ver el menú
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default ReservaExitosa;
