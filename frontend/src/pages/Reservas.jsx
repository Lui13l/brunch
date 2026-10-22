import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import "./Reservas.css";

const OCASIONES = ["Cumpleaños", "Aniversario", "Reunión de negocios", "Otro"];

// Fecha de hoy en formato YYYY-MM-DD según la hora local (para el mínimo del calendario).
const hoyLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const Reservas = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ dia: "", hora: "", cupo: "2", ocasion: "", detalles: "" });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const campo = (nombre) => ({
    value: form[nombre],
    onChange: (e) => setForm((f) => ({ ...f, [nombre]: e.target.value })),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const reserva = await api.post("/reservas", {
        dia: form.dia,
        hora: form.hora,
        cupo: Number(form.cupo),
        ocasion: form.ocasion || undefined,
        detalles: form.detalles || undefined,
      });
      navigate("/reserva-exitosa", { state: { reserva } });
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="reservas-main">
        <div className="reservas-card">
          <span className="reservas-eyebrow">Bienvenido, {user?.nombre}</span>
          <h1 className="reservas-title">Haz tu reserva</h1>
          <div className="reservas-divider">
            <span className="reservas-divider-line" />
            <span className="reservas-divider-gem">✦</span>
            <span className="reservas-divider-line" />
          </div>
          <p className="reservas-sub">
            Reserva tu mesa y disfruta de la mejor experiencia brunch
          </p>

          <form className="reservas-form" onSubmit={handleSubmit}>
            <div className="reservas-row">
              <div className="reservas-field">
                <label htmlFor="reserva-nombre">Nombre completo</label>
                <input id="reserva-nombre" type="text" value={user?.nombre || ""} readOnly />
              </div>
              <div className="reservas-field">
                <label htmlFor="reserva-correo">Correo electrónico</label>
                <input id="reserva-correo" type="email" value={user?.correo || ""} readOnly />
              </div>
            </div>

            <div className="reservas-row">
              <div className="reservas-field">
                <label htmlFor="reserva-dia">Fecha</label>
                <input id="reserva-dia" type="date" min={hoyLocal()} required {...campo("dia")} />
              </div>
              <div className="reservas-field">
                <label htmlFor="reserva-hora">Hora</label>
                <input id="reserva-hora" type="time" min="08:00" max="17:00" required {...campo("hora")} />
              </div>
            </div>

            <div className="reservas-row">
              <div className="reservas-field">
                <label htmlFor="reserva-cupo">Número de personas</label>
                <select id="reserva-cupo" {...campo("cupo")}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n} persona{n > 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>
              <div className="reservas-field">
                <label htmlFor="reserva-ocasion">Ocasión especial</label>
                <select id="reserva-ocasion" {...campo("ocasion")}>
                  <option value="">Sin ocasión especial</option>
                  {OCASIONES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="reservas-field">
              <label htmlFor="reserva-detalles">Notas adicionales</label>
              <textarea
                id="reserva-detalles"
                placeholder="Alergias, preferencias, solicitudes especiales..."
                rows={3}
                {...campo("detalles")}
              />
            </div>

            {error && <p className="reservas-error" role="alert">{error}</p>}

            <button type="submit" className="reservas-submit-btn" disabled={enviando}>
              {enviando ? "Reservando..." : "Confirmar reserva"}
            </button>
          </form>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default Reservas;
