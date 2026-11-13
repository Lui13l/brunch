import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import gsap from "gsap";
import WeatherBadge from "./WeatherBadge";
import { LOCAL, estadoDelLocal } from "../utils/horario";
import "./Hero.css";

const VIDEO = "https://res.cloudinary.com/dwhezsxkg/video/upload/v1778019228/homebrunchie_gd2laf.mp4";
// Un cuadro del mismo video: se ve mientras carga y en celulares, donde no se descarga el video.
const POSTER = "https://res.cloudinary.com/dwhezsxkg/video/upload/so_1,w_1600,q_auto,f_jpg/v1778019228/homebrunchie_gd2laf.jpg";

const PANTALLA_GRANDE = "(min-width: 769px)";

const Hero = () => {
  const heroRef = useRef(null);
  const [conVideo, setConVideo] = useState(() => globalThis.matchMedia(PANTALLA_GRANDE).matches);
  const [estado, setEstado] = useState(estadoDelLocal);

  useEffect(() => {
    const consulta = globalThis.matchMedia(PANTALLA_GRANDE);
    const alCambiar = () => setConVideo(consulta.matches);
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  // "Abierto hasta las 18:00" se actualiza solo si la página queda abierta.
  useEffect(() => {
    const reloj = setInterval(() => setEstado(estadoDelLocal()), 60_000);
    return () => clearInterval(reloj);
  }, []);

  useEffect(() => {
    if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".hero-linea > span", { yPercent: 105, duration: 0.9, stagger: 0.12 })
        .from(".hero-bajada", { y: 18, opacity: 0, duration: 0.6 }, "-=0.45")
        .from(".hero-acciones", { y: 18, opacity: 0, duration: 0.6 }, "-=0.45")
        .from(".hero-datos", { opacity: 0, duration: 0.7 }, "-=0.35");
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={heroRef} className="hero-bg" style={{ backgroundImage: `url(${POSTER})` }}>
      {conVideo && (
        <video className="hero-video" poster={POSTER} autoPlay muted loop playsInline aria-hidden="true">
          <source src={VIDEO} type="video/mp4" />
        </video>
      )}
      <div className="hero-velo" aria-hidden="true" />

      <div className="hero-contenido contenedor">
        <h1 className="hero-title">
          <span className="hero-linea"><span>El brunch</span></span>
          <span className="hero-linea"><span>se toma con calma</span></span>
        </h1>
        <p className="hero-bajada">
          Cocina fresca todo el día, café servido sin afán y un jardín donde tu mascota también es bienvenida.
        </p>
        <div className="hero-acciones">
          <Link to="/reservas" className="boton boton--crema">Reservar mesa</Link>
          <Link to="/menu" className="boton boton--contorno-claro">Ver el menú</Link>
        </div>

        <ul className="hero-datos">
          <li>
            <span className={`hero-punto${estado.abierto ? " hero-punto--abierto" : ""}`} aria-hidden="true" />
            {estado.texto}
          </li>
          <WeatherBadge />
          <li>
            <MapPin size={16} strokeWidth={1.8} aria-hidden="true" />
            {LOCAL.direccion}
          </li>
        </ul>
      </div>
    </section>
  );
};

export default Hero;
