import { useState } from "react";
import { ArrowLeft, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import "./PerfilUsuario.css";

const PerfilUsuario = () => {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: user?.nombre || "",
    direccion: user?.direccion || "",
    celular: user?.celular || "",
    password: "",
    confirmarPassword: "",
  });
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  const cambiarCampo = (e) => {
    const { name, value } = e.target;
    setForm((actual) => ({ ...actual, [name]: value }));
  };

  const guardarPerfil = async (e) => {
    e.preventDefault();
    setError("");
    setMensaje("");

    if (form.password && form.password.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (form.password !== form.confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setGuardando(true);
    try {
      const datos = {
        nombre: form.nombre,
        direccion: form.direccion,
        celular: form.celular,
        ...(form.password ? { password: form.password } : {}),
      };
      const usuarioActualizado = await api.put("/usuarios/perfil", datos);
      setUser(usuarioActualizado);
      setForm((actual) => ({ ...actual, password: "", confirmarPassword: "" }));
      setMensaje("Tu perfil se actualizó correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const cerrarSesion = async () => {
    setError("");
    setCerrandoSesion(true);
    try {
      await api.post("/auth/logout");
      logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message);
      setCerrandoSesion(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="perfil-main">
        <div className="perfil-shell">
          <button type="button" className="perfil-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} aria-hidden="true" />
            Volver
          </button>

          <section className="perfil-card" aria-labelledby="perfil-title">
            <div className="perfil-avatar" aria-label="Foto de perfil">
              <UserRound size={42} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <span className="perfil-eyebrow">Tu cuenta</span>
            <h1 id="perfil-title" className="perfil-title">Mi perfil</h1>
            <p className="perfil-subtitle">Administra la información de tu cuenta.</p>

            <form className="perfil-form" onSubmit={guardarPerfil}>
              <div className="perfil-field">
                <label htmlFor="perfil-nombre">Nombre de usuario</label>
                <input
                  id="perfil-nombre"
                  name="nombre"
                  type="text"
                  autoComplete="name"
                  value={form.nombre}
                  onChange={cambiarCampo}
                  required
                />
              </div>

              <div className="perfil-field">
                <label htmlFor="perfil-correo">Correo electrónico</label>
                <input
                  id="perfil-correo"
                  type="email"
                  autoComplete="email"
                  value={user?.correo || ""}
                  readOnly
                />
              </div>

              <div className="perfil-field">
                <label htmlFor="perfil-direccion">Dirección</label>
                <input
                  id="perfil-direccion"
                  name="direccion"
                  type="text"
                  autoComplete="street-address"
                  placeholder="Tu dirección"
                  value={form.direccion}
                  onChange={cambiarCampo}
                />
              </div>

              <div className="perfil-field">
                <label htmlFor="perfil-celular">Teléfono</label>
                <input
                  id="perfil-celular"
                  name="celular"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Tu número de teléfono"
                  value={form.celular}
                  onChange={cambiarCampo}
                />
              </div>

              <div className="perfil-field">
                <label htmlFor="perfil-password">Nueva contraseña</label>
                <input
                  id="perfil-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Deja este campo vacío para mantenerla"
                  value={form.password}
                  onChange={cambiarCampo}
                />
                <span className="perfil-help">Tu contraseña actual nunca se muestra.</span>
              </div>

              <div className="perfil-field">
                <label htmlFor="perfil-confirmar-password">Confirmar nueva contraseña</label>
                <input
                  id="perfil-confirmar-password"
                  name="confirmarPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repite la nueva contraseña"
                  value={form.confirmarPassword}
                  onChange={cambiarCampo}
                />
              </div>

              {error && <p className="perfil-error" role="alert">{error}</p>}
              {mensaje && <p className="perfil-success" role="status">{mensaje}</p>}

              <button type="submit" className="perfil-save" disabled={guardando || cerrandoSesion}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>

            <div className="perfil-logout-area">
              <button
                type="button"
                className="perfil-logout"
                onClick={cerrarSesion}
                disabled={cerrandoSesion || guardando}
              >
                {cerrandoSesion ? "Cerrando sesión..." : "Cerrar sesión"}
              </button>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default PerfilUsuario;