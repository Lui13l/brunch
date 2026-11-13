import { useEffect, useState } from "react";
import "./PortadaPagina.css";

const VIDEO = "https://res.cloudinary.com/dwhezsxkg/video/upload/v1778112262/menubrunch_xe5q9r.mp4";
// Un cuadro del mismo video: se ve mientras carga y en celulares, donde no se descarga el video.
const POSTER = "https://res.cloudinary.com/dwhezsxkg/video/upload/so_1,w_1600,q_auto,f_jpg/v1778112262/menubrunch_xe5q9r.jpg";

const PANTALLA_GRANDE = "(min-width: 769px)";

// Portada con video de las páginas interiores (Menú y Contacto). Lo que se
// pase como `children` queda debajo del título, dentro de la portada.
const PortadaPagina = ({ titulo, bajada, className = "", children }) => {
  const [conVideo, setConVideo] = useState(() => globalThis.matchMedia(PANTALLA_GRANDE).matches);

  useEffect(() => {
    const consulta = globalThis.matchMedia(PANTALLA_GRANDE);
    const alCambiar = () => setConVideo(consulta.matches);
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  return (
    <section className={`portada ${className}`} style={{ backgroundImage: `url(${POSTER})` }}>
      {conVideo && (
        <video className="portada-video" poster={POSTER} autoPlay muted loop playsInline aria-hidden="true">
          <source src={VIDEO} type="video/mp4" />
        </video>
      )}
      <div className="portada-velo" aria-hidden="true" />

      <div className="portada-contenido contenedor">
        <h1 className="portada-titulo">{titulo}</h1>
        {bajada && <p className="portada-bajada">{bajada}</p>}
        {children}
      </div>
    </section>
  );
};

export default PortadaPagina;
