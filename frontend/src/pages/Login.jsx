import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const REGISTRO_VACIO = { nombre: "", correo: "", celular: "", password: "", confirmar: "" };

const Login = () => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registro, setRegistro] = useState(REGISTRO_VACIO);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Vuelve a la página que pidió el login (por ejemplo /reservas o /checkout).
  const destino = location.state?.from || "/";

  if (user && !enviando) return <Navigate to={destino} replace />;

  const cambiarModo = (nuevo) => {
    setMode(nuevo);
    setError("");
  };

  const enviar = async (accion) => {
    setError("");
    setEnviando(true);
    try {
      await accion();
      navigate(destino, { replace: true });
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    enviar(() => login(email, password));
  };

  const handleRegister = (e) => {
    e.preventDefault();
    if (registro.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (registro.password !== registro.confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    const { confirmar: _confirmar, ...datos } = registro;
    enviar(() => register(datos));
  };

  const campo = (nombre) => ({
    value: registro[nombre],
    onChange: (e) => setRegistro((r) => ({ ...r, [nombre]: e.target.value })),
  });

  return (
    <>
      <Navbar />

      <main className="login-main">
        <div className="login-card">
          <span className="login-eyebrow">Bienvenido</span>
          <h1 className="login-title">
            {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </h1>
          <div className="login-divider">
            <span className="login-divider-line" />
            <span className="login-divider-gem">✦</span>
            <span className="login-divider-line" />
          </div>
          <p className="login-sub">
            {mode === "login"
              ? "Inicia sesión para hacer tu reserva o tu pedido"
              : "Regístrate para hacer tu reserva o tu pedido"}
          </p>

          {/* Tabs */}
          <div className="login-tabs">
            <button
              type="button"
              className={`login-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => cambiarModo("login")}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={`login-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => cambiarModo("register")}
            >
              Registrarse
            </button>
          </div>

          {/* Formulario de inicio de sesión */}
          {mode === "login" && (
            <form className="login-form" onSubmit={handleLogin}>
              <div className="login-field">
                <label htmlFor="login-correo">Correo electrónico</label>
                <input
                  id="login-correo"
                  type="email"
                  autoComplete="email"
                  placeholder="tucorreo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="login-field">
                <label htmlFor="login-password">Contraseña</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="login-error" role="alert">{error}</p>}
              <button type="submit" className="login-submit-btn" disabled={enviando}>
                {enviando ? "Ingresando..." : "Iniciar sesión"}
              </button>
            </form>
          )}

          {/* Formulario de registro */}
          {mode === "register" && (
            <form className="login-form" onSubmit={handleRegister}>
              <div className="login-field">
                <label htmlFor="registro-nombre">Nombre completo</label>
                <input id="registro-nombre" type="text" autoComplete="name" placeholder="Tu nombre" required {...campo("nombre")} />
              </div>
              <div className="login-field">
                <label htmlFor="registro-correo">Correo electrónico</label>
                <input id="registro-correo" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" required {...campo("correo")} />
              </div>
              <div className="login-field">
                <label htmlFor="registro-celular">Celular</label>
                <input id="registro-celular" type="tel" autoComplete="tel" placeholder="300 000 0000" {...campo("celular")} />
              </div>
              <div className="login-field">
                <label htmlFor="registro-password">Contraseña</label>
                <input id="registro-password" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" required {...campo("password")} />
              </div>
              <div className="login-field">
                <label htmlFor="registro-confirmar">Confirmar contraseña</label>
                <input id="registro-confirmar" type="password" autoComplete="new-password" placeholder="••••••••" required {...campo("confirmar")} />
              </div>
              {error && <p className="login-error" role="alert">{error}</p>}
              <button type="submit" className="login-submit-btn" disabled={enviando}>
                {enviando ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
};

export default Login;
