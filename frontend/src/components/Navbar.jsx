import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import gsap from "gsap";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

const Navbar = () => {
  const navRef = useRef(null);
  const { count, setIsOpen } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Menú desplegable en pantallas pequeñas (Bulma oculta el menú por debajo de 1024px).
  // Cada página monta su propio Navbar, así que al navegar el menú vuelve a cerrarse.
  const [menuAbierto, setMenuAbierto] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".nav-animate", {
        y: -20,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "power2.out",
      });
    }, navRef);

    return () => ctx.revert();
  }, []);

  return (
    <nav ref={navRef} className="navbar navbar-custom" role="navigation">
      <div className="navbar-brand">
        <Link to="/" className="navbar-item nav-animate brand-name">
          Brunch & Co.
        </Link>
        <button
          type="button"
          className={`navbar-burger${menuAbierto ? " is-active" : ""}`}
          aria-label="Abrir menú"
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
          <Link to="/" className="navbar-item nav-link nav-animate">Inicio</Link>
          <Link to="/menu" className="navbar-item nav-link nav-animate">Menú</Link>
          <Link to="/about" className="navbar-item nav-link nav-animate">Nosotros</Link>
          <Link to="/contact" className="navbar-item nav-link nav-animate">Contacto</Link>
          <div className="navbar-item nav-animate">
            <button className="cart-icon-btn" onClick={() => setIsOpen(true)} aria-label="Abrir carrito">
              <ShoppingBag size={20} strokeWidth={1.8} />
              {count > 0 && <span className="cart-badge">{count}</span>}
            </button>
          </div>
          {user ? (
            <>
              <span className="navbar-item nav-user nav-animate">Hola, {user.nombre.split(" ")[0]}</span>
              <button type="button" className="navbar-item nav-link nav-logout nav-animate" onClick={handleLogout}>
                Salir
              </button>
            </>
          ) : (
            <Link to="/login" className="navbar-item nav-link nav-animate">Ingresar</Link>
          )}
          <div className="navbar-item nav-animate">
            <Link to="/reservas" className="button reservar-btn">Reservar</Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
