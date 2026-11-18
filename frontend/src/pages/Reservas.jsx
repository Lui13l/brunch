import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { usePantallaCarga } from "../context/CargaContext";
import { crearReserva } from "../services/reservasService";
import { useFestivos } from "../hooks/useFestivos";
import { HORARIO, festivoDe, horarioDelDia } from "../utils/horario";
import "./Reservas.css";

const dosCifras = (n) => String(n).padStart(2, "0");

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
  const { cubrir } = usePantallaCarga();
  const [form, setForm] = useState({ dia: "", hora: "", cupo: "2", ocasion: "", detalles: "" });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Un festivo se atiende como fin de semana: el campo de hora y la ayuda
  // bajo la fecha muestran el horario del día elegido.
  const anioElegido = Number(form.dia.slice(0, 4)) || new Date().getFullYear();
  const festivos = useFestivos(anioElegido);
  const festivo = form.dia ? festivoDe(form.dia, festivos) : null;
  const horario = form.dia ? horarioDelDia(form.dia, festivos) : HORARIO.semana;

  const campo = (nombre) => ({
    value: form[nombre],
    onChange: (e) => setForm((f) => ({ ...f, [nombre]: e.target.value })),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const reserva = await crearReserva({
        dia: form.dia,
        hora: form.hora,
        cupo: Number(form.cupo),
        ocasion: form.ocasion || undefined,
        detalles: form.detalles || undefined,
      });
      // Ya quedó guardada: la confirmación aparece detrás de la pantalla de carga.
      await cubrir("Guardando tu mesa…");
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
        <div className="reservas-card tarjeta entrada-pagina">
          <h1 className="reservas-title">Reserva tu mesa</h1>
          <p className="reservas-sub">
            Hola, {user?.nombre?.split(" ")[0]}. Dinos cuándo vienes y te guardamos el lugar.
          </p>

          <form className="reservas-form" onSubmit={handleSubmit}>
            <div className="fila-campos">
              <div className="campo">
                <label htmlFor="reserva-nombre">Nombre completo</label>
                <input id="reserva-nombre" type="text" value={user?.nombre || ""} readOnly />
              </div>
              <div className="campo">
                <label htmlFor="reserva-correo">Correo electrónico</label>
                <input id="reserva-correo" type="email" value={user?.correo || ""} readOnly />
              </div>
            </div>

            <div className="fila-campos">
              <div className="campo">
                <label htmlFor="reserva-dia">Fecha</label>
                <input
                  id="reserva-dia"
                  type="date"
                  min={hoyLocal()}
                  required
                  aria-describedby={form.dia ? "reserva-dia-horario" : undefined}
                  {...campo("dia")}
                />
                {form.dia && (
                  <small id="reserva-dia-horario" className="campo-ayuda">
                    {festivo ? `Es festivo (${festivo}): ` : "Ese día "}
                    atendemos de {horario.horas.replace(" – ", " a ")}.
                  </small>
                )}
              </div>
              <div className="campo">
                <label htmlFor="reserva-hora">Hora</label>
                <input
                  id="reserva-hora"
                  type="time"
                  min={`${dosCifras(horario.abre)}:00`}
                  max={`${dosCifras(horario.cierra - 1)}:59`}
                  required
                  {...campo("hora")}
                />
              </div>
            </div>

            <div className="fila-campos">
              <div className="campo">
                <label htmlFor="reserva-cupo">Número de personas</label>
                <select id="reserva-cupo" {...campo("cupo")}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n} persona{n > 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="reserva-ocasion">Ocasión especial</label>
                <select id="reserva-ocasion" {...campo("ocasion")}>
                  <option value="">Sin ocasión especial</option>
                  {OCASIONES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="campo">
              <label htmlFor="reserva-detalles">Notas adicionales</label>
              <textarea
                id="reserva-detalles"
                placeholder="Alergias, preferencias, solicitudes especiales..."
                rows={3}
                {...campo("detalles")}
              />
            </div>

            {error && <p className="aviso aviso--error" role="alert">{error}</p>}

            <button type="submit" className="boton boton--primario boton--ancho" disabled={enviando}>
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
