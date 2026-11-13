import { CalendarDays, ClipboardList, LogOut, UserRound } from "lucide-react";

const OPCIONES = [
  { id: "perfil", texto: "Perfil", icono: <UserRound size={18} aria-hidden="true" /> },
  { id: "pedidos", texto: "Pedidos", icono: <ClipboardList size={18} aria-hidden="true" /> },
  { id: "reservas", texto: "Reservas", icono: <CalendarDays size={18} aria-hidden="true" /> },
];

export default function PerfilSidebar({ user, seccion, onCambiar, onCerrarSesion, cerrandoSesion, guardando }) {
  return (
    <aside className="perfil-sidebar" aria-label="Menú de cuenta">
      <div className="perfil-sidebar-user">
        <div className="perfil-avatar" aria-hidden="true">
          <UserRound size={36} strokeWidth={1.5} />
        </div>
        <span className="perfil-sidebar-name">{user?.nombre}</span>
        <span className="perfil-sidebar-email">{user?.correo}</span>
      </div>
      <nav className="perfil-nav">
        {OPCIONES.map(({ id, texto, icono }) => (
          <button
            key={id}
            type="button"
            className={`perfil-nav-item${seccion === id ? " is-active" : ""}`}
            onClick={() => onCambiar(id)}
            aria-current={seccion === id ? "page" : undefined}
          >
            {icono}
            {texto}
          </button>
        ))}
        <button
          type="button"
          className="perfil-nav-item perfil-nav-logout"
          onClick={onCerrarSesion}
          disabled={cerrandoSesion || guardando}
        >
          <LogOut size={18} aria-hidden="true" />
          {cerrandoSesion ? "Cerrando sesión..." : "Cerrar sesión"}
        </button>
      </nav>
    </aside>
  );
}
