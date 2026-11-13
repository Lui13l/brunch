import { Link } from "react-router-dom";
import { Clock, MapPin, Phone } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ChatBox from "../components/ChatBox";
import PortadaPagina from "../components/PortadaPagina";
import { HORARIO, LOCAL } from "../utils/horario";
import brunchShop from "../assets/brunchshop.jpg";
import "./ContactUs.css";

const ContactUs = () => {
  return (
    <>
      <Navbar sobreFoto />

      <PortadaPagina
        titulo="Contáctanos"
        bajada="En Brunch & Co. somos una familia unida dispuesta a ayudarte."
      />

      <main className="contact-main">
        <div className="contenedor contact-wrapper">
          <section className="contact-info" aria-labelledby="contacto-titulo">
            <h2 id="contacto-titulo" className="titulo-seccion">Hagamos de tu mañana algo especial</h2>

            <p className="bajada">
              Nuestro espacio fue creado para disfrutar sin afán, compartir buena comida y vivir una
              experiencia cálida en cada visita.
            </p>

            <ul className="contact-datos">
              <li>
                <MapPin size={18} strokeWidth={1.8} aria-hidden="true" />
                {LOCAL.direccion}
              </li>
              <li>
                <Clock size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>
                  {HORARIO.semana.texto}, {HORARIO.semana.horas}
                  <br />
                  {HORARIO.finde.texto}, {HORARIO.finde.horas}
                </span>
              </li>
              <li>
                <Phone size={18} strokeWidth={1.8} aria-hidden="true" />
                <a href={`tel:${LOCAL.telefono.replace(/\s/g, "")}`}>{LOCAL.telefono}</a>
              </li>
            </ul>

            <Link to="/reservas" className="boton boton--primario">Reservar mesa</Link>

            <img src={brunchShop} alt="Barra de café del local de Brunch & Co." className="contact-image" loading="lazy" />
          </section>

          <section className="contact-chat tarjeta" aria-labelledby="chat-titulo">
            <div className="contact-chat-header">
              <span className="contact-chat-avatar" aria-hidden="true">B</span>
              <div>
                <h2 id="chat-titulo" className="contact-chat-titulo">Asistente de Brunch & Co.</h2>
                <p className="contact-chat-estado">Responde al instante</p>
              </div>
            </div>
            <ChatBox />
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default ContactUs;
