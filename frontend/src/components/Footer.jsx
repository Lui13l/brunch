import { Link } from "react-router-dom";
import SocialLinks from "./SocialLinks";
import { HORARIO, LOCAL } from "../utils/horario";
import "./Footer.css";

const Footer = () => {
  return (
    <footer className="custom-footer">
      <div className="contenedor">
        <div className="footer-cols">
          <div className="footer-marca">
            <Link to="/" className="footer-logo">Brunch & Co.</Link>
            <p className="footer-text">
              Abierto todos los días para compartir brunch y buenos momentos.
            </p>
            <SocialLinks color="currentColor" size={18} />
          </div>

          <nav className="footer-col" aria-label="Enlaces del pie de página">
            <h3 className="footer-title">Explora</h3>
            <ul className="footer-lista">
              <li><Link to="/menu">Menú</Link></li>
              <li><Link to="/reservas">Reservar mesa</Link></li>
              <li><Link to="/about">Nosotros</Link></li>
              <li><Link to="/contact">Contacto</Link></li>
            </ul>
          </nav>

          <div className="footer-col">
            <h3 className="footer-title">Horario</h3>
            <ul className="footer-lista">
              <li>
                {HORARIO.semana.texto}
                <span>{HORARIO.semana.horas}</span>
              </li>
              <li>
                {HORARIO.finde.texto}
                <span>{HORARIO.finde.horas}</span>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h3 className="footer-title">Visítanos</h3>
            <ul className="footer-lista">
              <li>{LOCAL.direccion}</li>
              <li>
                <a href={`tel:${LOCAL.telefono.replace(/\s/g, "")}`}>{LOCAL.telefono}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Brunch & Co. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
