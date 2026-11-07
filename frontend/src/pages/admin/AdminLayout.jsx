import { NavLink, Outlet } from "react-router-dom";
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  ExternalLink,
  History,
  MessageCircle,
  Tags,
  Truck,
  Users,
} from "lucide-react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { abrirComandas } from "../../services/adminService";
import "./admin.css";

const SECCIONES = [
  { a: "/admin/pedidos", texto: "Pedidos", Icono: ClipboardList },
  { a: "/admin/menu", texto: "Menú", Icono: BookOpen },
  { a: "/admin/categorias", texto: "Categorías", Icono: Tags },
  { a: "/admin/reservas", texto: "Reservas", Icono: CalendarCheck },
  { a: "/admin/pagos", texto: "Pagos", Icono: CreditCard },
  { a: "/admin/domiciliarios", texto: "Domiciliarios", Icono: Truck },
  { a: "/admin/usuarios", texto: "Usuarios y roles", Icono: Users },
  { a: "/admin/chatbot", texto: "Chatbot", Icono: MessageCircle },
  { a: "/admin/auditoria", texto: "Auditoría", Icono: History },
];

// Panel de administración de la web. Desde aquí también se abre la app de
// comandas (salón, cocina, caja, inventario) con la sesión ya iniciada.
export default function AdminLayout() {
  return (
    <>
      <Navbar />
      <main className="adm-main">
        <div className="adm-shell">
          <header className="adm-cabecera">
            <div>
              <span className="adm-eyebrow">Brunch &amp; Co.</span>
              <h1 className="adm-h1">Administración</h1>
            </div>
            <button type="button" className="button adm-boton-comandas" onClick={abrirComandas}>
              <ExternalLink size={18} aria-hidden="true" />
              <span>Abrir comandas</span>
            </button>
          </header>

          <div className="adm-cuerpo">
            <nav className="adm-nav" aria-label="Secciones de administración">
              {SECCIONES.map((seccion) => (
                <NavLink key={seccion.a} to={seccion.a} className={({ isActive }) => `adm-nav-item${isActive ? " is-active" : ""}`}>
                  <seccion.Icono size={18} aria-hidden="true" />
                  <span>{seccion.texto}</span>
                </NavLink>
              ))}
            </nav>
            <section className="adm-contenido">
              <Outlet />
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
