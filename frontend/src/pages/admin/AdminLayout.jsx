import { NavLink, Outlet } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { abrirComandas } from "../../services/adminService";
import "./admin.css";

const SECCIONES = [
  { a: "/admin/pedidos", texto: "Pedidos" },
  { a: "/admin/menu", texto: "Menú" },
  { a: "/admin/categorias", texto: "Categorías" },
  { a: "/admin/reservas", texto: "Reservas" },
  { a: "/admin/pagos", texto: "Pagos" },
  { a: "/admin/domiciliarios", texto: "Domiciliarios" },
  { a: "/admin/usuarios", texto: "Usuarios y roles" },
  { a: "/admin/chatbot", texto: "Chatbot" },
  { a: "/admin/auditoria", texto: "Auditoría" },
];

const hoy = () => {
  const texto = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Panel de administración de la web: la libreta del encargado. Desde aquí
// también se abre la app de comandas con la sesión ya iniciada.
export default function AdminLayout() {
  return (
    <>
      <Navbar />
      <main className="adm-main">
        <div className="adm-shell">
          <header className="adm-cabecera">
            <div>
              <h1 className="adm-h1">Administración</h1>
              <p className="adm-fecha">{hoy()}</p>
            </div>
            <button type="button" className="button adm-boton-comandas" onClick={abrirComandas}>
              <span>Abrir comandas</span>
              <ExternalLink size={16} aria-hidden="true" />
            </button>
          </header>

          <nav className="adm-nav" aria-label="Secciones de administración">
            {SECCIONES.map(({ a, texto }) => (
              <NavLink key={a} to={a} className={({ isActive }) => `adm-nav-item${isActive ? " is-active" : ""}`}>
                {texto}
              </NavLink>
            ))}
          </nav>

          <section className="adm-contenido">
            <Outlet />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
