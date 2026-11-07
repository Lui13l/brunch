import { ChevronLeft, LogOut } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/sesion";
import { INICIO_POR_ROL, NOMBRE_ROL } from "../lib/formato";

export function RutaProtegida({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" state={{ desde: location.pathname }} replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to={INICIO_POR_ROL[user.rol] ?? "/login"} replace />;
  return children;
}

// El encabezado es cromo: color de marca, y nada que compita con el contenido.
export function Cabecera({ titulo, atras, acciones }) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 bg-rio px-3 py-2.5 text-white">
      {atras && (
        <Link
          to={atras}
          aria-label="Volver"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white/80 active:bg-white/15"
        >
          <ChevronLeft size={24} />
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate px-1 text-xl font-extrabold tracking-[-0.02em]">{titulo}</h1>
      {acciones}
      {user && (
        <span className="hidden shrink-0 rounded-md bg-white/15 px-2.5 py-1 text-[13px] font-bold sm:block">
          {NOMBRE_ROL[user.rol] ?? user.rol}
        </span>
      )}
      <button
        onClick={logout}
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white/80 active:bg-white/15"
      >
        <LogOut size={20} />
      </button>
    </header>
  );
}

export function Pantalla({ children }) {
  return <div className="min-h-full bg-sala pb-24">{children}</div>;
}
