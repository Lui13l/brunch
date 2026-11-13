import brunch from "../assets/brunch.jpg";
import tostada from "../assets/tostada.jpg";
import brunchShop from "../assets/brunchshop.jpg";
import "./InstagramFeed.css";

// Mosaico con fotos propias. Antes era un widget externo de Instagram
// (SnapWidget) que dejó de funcionar y mostraba un aviso de error.
const FOTOS = [
  { src: brunchShop, alt: "Barra de café de Brunch & Co." },
  { src: tostada, alt: "Tostadas francesas con banano y arándanos" },
  { src: "/menu/latte.jpg", alt: "Latte con arte en la espuma" },
  { src: brunch, alt: "Plato de brunch con pan tostado y huevos" },
  { src: "/menu/acai_bowl.jpg", alt: "Açaí bowl con fruta fresca" },
];

const InstagramFeed = () => {
  return (
    <section className="instagram-section">
      <div className="contenedor">
        <div className="instagram-encabezado">
          <h2 className="titulo-seccion">Así se ve una mañana aquí</h2>
          <p className="instagram-usuario">@brunchandco en Instagram</p>
        </div>

        <ul className="instagram-mosaico">
          {FOTOS.map((foto) => (
            <li key={foto.alt}>
              <img src={foto.src} alt={foto.alt} loading="lazy" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default InstagramFeed;
