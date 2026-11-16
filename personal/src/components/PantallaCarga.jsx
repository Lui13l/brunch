import pancito from "../assets/pancito-loader-set-transparente.webp";
import hojaPancito from "../assets/pancito-sprite-set-transparente.webp";

// Pantalla de carga con el pancito caminando, la misma de la web. Allá la
// mueve GSAP; aquí todo el movimiento es CSS (las clases `carga-*` de
// index.css), para no traer esa librería a la app del personal.
//
// La hoja trae 8 cuadros en 4 columnas y 2 filas. Quien la pone y la quita es
// CargaContext; este componente solo dibuja.
export default function PantallaCarga({ mensaje, inmediata = false, saliendo = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`carga ${inmediata ? "" : "carga--entra"} ${saliendo ? "carga--sale" : ""}`}
    >
      <div className="carga-escena" aria-hidden="true">
        <div className="carga-plato" />
        <div className="carga-pan-caja">
          {/* Con animaciones, la hoja de cuadros; sin ellas, el pancito quieto. */}
          <div className="carga-pan" style={{ backgroundImage: `url(${hojaPancito})` }} />
          <img className="carga-pan-quieto" src={pancito} alt="" />
        </div>
        <div className="carga-sombra" />
        <div className="carga-suelo" />
      </div>

      <p className="mt-6 font-titulo text-2xl font-semibold tracking-[-0.02em] text-tinta">{mensaje}</p>
      <div className="carga-barra" aria-hidden="true">
        <div className="carga-barra-relleno" />
      </div>
    </div>
  );
}
