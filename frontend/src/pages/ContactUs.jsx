import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SocialLinks from "../components/SocialLinks";
import ChatBox from "../components/ChatBox";
import "./ContactUs.css";
import brunchShop from "../assets/brunchshop.jpg"

const ContactUs = () => {
  return (
    <>
      <Navbar />

      <section className="menu-hero">
        <video
          className="menu-hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        >
          <source
            src="https://res.cloudinary.com/dwhezsxkg/video/upload/v1778112262/menubrunch_xe5q9r.mp4"
            type="video/mp4"
          />
        </video>
        <div className="menu-hero-overlay">
          <h1 className="contact-hero-title">Contáctanos</h1>
          <p className="menu-hero-sub">En Brunch & Co. somos una familia unida dispuesta a ayudarte</p>
        </div>
      </section>

      <main className="contact-main">
        <div className="contact-wrapper">

          <section className="contact-card contact-info">
            <span className="contact-eyebrow">Brunch & Co.</span>

            <h2 className="contact-heading">
              Hagamos de tu mañana algo especial
            </h2>

            <p className="contact-body">
              Nuestro espacio fue creado para disfrutar sin afán,
              compartir buena comida y vivir una experiencia cálida
              en cada visita.
            </p>

            <Link to="/reservas" className="button is-black is-rounded mt-4">
              Reservar mesa
            </Link>
            <img src={brunchShop} alt="Local de Brunch & Co." className="contact-image" />
          </section>

          <section className="contact-card contact-form">
            <span className="contact-eyebrow">Asistente virtual</span>
            <h2 className="contact-heading">¿En qué podemos ayudarte?</h2>
            <ChatBox />
          </section>

        </div>
      </main>

      <Footer />
    </>
  );
};

export default ContactUs;
