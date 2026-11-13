import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

// Navbar transparente y fijo. `sobreFoto`: la página empieza con una foto o
// video oscuro (Inicio, Menú, Contacto), así que arriba va en blanco sobre la
// imagen. En el resto va en café sobre la crema. Al bajar, o con el menú del
// celular abierto, toma un fondo crema translúcido para no chocar con nada.
// `alRas`: la página dibuja su propio fondo bajo el navbar (sin espaciador).
const UMBRAL_SCROLL = 24;

const ENLACES = [
  { a: "/", texto: "Inicio" },
  { a: "/menu", texto: "Menú" },
  { a: "/about", texto: "Nosotros" },
  { a: "/contact", texto: "Contacto" },
];

const claseEnlace = ({ isActive }) => `navbar-item nav-link${isActive ? " nav-link--activo" : ""}`;

const Navbar = ({ sobreFoto = false, alRas = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Menú desplegable en pantallas pequeñas (Bulma oculta el menú por debajo de 1024px).
  // Cada página monta su propio Navbar, así que al navegar el menú vuelve a cerrarse.
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [conScroll, setConScroll] = useState(() => window.scrollY > UMBRAL_SCROLL);

  useEffect(() => {
    const alDesplazar = () => setConScroll(window.scrollY > UMBRAL_SCROLL);
    alDesplazar();
    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => window.removeEventListener("scroll", alDesplazar);
  }, []);

  // Con el menú del celular abierto, Escape lo cierra.
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const alTeclear = (e) => {
      if (e.key === "Escape") setMenuAbierto(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [menuAbierto]);

  const conFondo = conScroll || menuAbierto;
  let tono = "nav-sobre-crema";
  if (conFondo) tono = "nav-con-fondo";
  else if (sobreFoto) tono = "nav-sobre-foto";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <>
      <nav className={`navbar navbar-custom ${tono}`} role="navigation" aria-label="Navegación principal">
        <div className="navbar-brand">
          <Link to="/" className="navbar-item brand-name">
            Brunch & Co.
          </Link>
          <button
            type="button"
            className={`navbar-burger${menuAbierto ? " is-active" : ""}`}
            aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>

        <div className={`navbar-menu${menuAbierto ? " is-active" : ""}`}>
          <div className="navbar-end">
            {ENLACES.map(({ a, texto }) => (
              <NavLink key={a} to={a} end={a === "/"} className={claseEnlace}>
                {texto}
              </NavLink>
            ))}

            <span className="nav-separador" aria-hidden="true" />

            {user ? (
              <>
                {user.rol_id === "admin" && (
                  <div className="navbar-item nav-item-icono">
                    <Link to="/admin" className="nav-icono-btn" aria-label="Administración" title="Administración">
                      <LayoutDashboard size={20} strokeWidth={1.8} aria-hidden="true" />
                      <span className="nav-icono-texto">Administración</span>
                    </Link>
                  </div>
                )}
                <NavLink to="/perfil" className={({ isActive }) => `navbar-item nav-user${isActive ? " nav-link--activo" : ""}`}>
                  Hola, {user.nombre.split(" ")[0]}
                </NavLink>
                <button type="button" className="navbar-item nav-link nav-logout" onClick={handleLogout}>
                  Salir
                </button>
              </>
            ) : (
              <NavLink to="/login" className={claseEnlace}>Ingresar</NavLink>
            )}

            <div className="navbar-item nav-item-reservar">
              <Link to="/reservas" className="reservar-btn">Reservar</Link>
            </div>
          </div>
        </div>
      </nav>
      {/* Las páginas sin foto arriba necesitan que el contenido empiece bajo el navbar fijo. */}
      {!sobreFoto && !alRas && <div className="nav-espaciador" aria-hidden="true" />}
    </>
  );
};

export default Navbar;
