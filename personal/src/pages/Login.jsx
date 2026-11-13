import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/sesion";
import { INICIO_POR_ROL } from "../lib/formato";
import { Boton } from "../components/ui";

// La entrada es el único sitio donde la marca ocupa toda la pantalla: a partir
// de aquí el color pasa a significar tiempo y estado, y deja de decorar.
export default function Login() {
  const { user, login, motivo } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  if (user) return <Navigate to={INICIO_POR_ROL[user.rol] ?? "/mesas"} replace />;

  const enviar = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    const resultado = await login(email.trim(), password);
    setCargando(false);
    if (resultado.ok) navigate(INICIO_POR_ROL[resultado.rol] ?? "/mesas", { replace: true });
    else setError(resultado.error);
  };

  return (
    <div className="flex min-h-full flex-col justify-center bg-rio px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-4xl leading-none font-extrabold tracking-[-0.035em] text-white">Brunch &amp; Co.</h1>
        <p className="mt-1 mb-7 text-xl font-semibold text-white/70">Comandas del salón</p>

        <form onSubmit={enviar} className="rounded-2xl bg-mantel p-5">
          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-semibold text-tinta-2">Correo</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
              className="min-h-12 w-full rounded-lg border border-filete px-3 text-[17px] text-tinta outline-none focus:border-caramelo"
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-1 block text-sm font-semibold text-tinta-2">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="min-h-12 w-full rounded-lg border border-filete px-3 text-[17px] text-tinta outline-none focus:border-caramelo"
            />
          </label>

          {(error || motivo) && (
            <p className="mb-4 border-l-4 border-brasa bg-brasa/8 px-3 py-2 text-[15px] font-semibold text-brasa">
              {error || motivo}
            </p>
          )}

          <Boton type="submit" cargando={cargando} className="w-full">
            Entrar
          </Boton>
        </form>
      </div>
    </div>
  );
}
