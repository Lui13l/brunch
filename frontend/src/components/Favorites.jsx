import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import gsap from "gsap";
import { listarProductos } from "../services/menuService";
import { formatearPrecio } from "../utils/formato";
import "./Favorites.css";

// Platos que se destacan en el inicio, en este orden. El precio y la
// descripción salen de la carta real; mientras llega (o si falla) se muestran
// solo con su foto.
const FAVORITOS = [
  { nombre: "Pancakes", img: "/menu/pancakes.jpg" },
  { nombre: "Avocado Toast Campestre", img: "/menu/avocado.jpg" },
  { nombre: "Matcha Latte", img: "/menu/matcha_latte.jpg" },
  { nombre: "Eggs Benedict", img: "/menu/eggs.jpg" },
  { nombre: "Torrijas de Ricotta", img: "/menu/torrejon.jpg" },
  { nombre: "Mimosa", img: "/menu/mimosa_coctel.jpg" },
  { nombre: "Brunch de la casa", img: "/menu/casa.jpg" },
  { nombre: "Açaí bowl", img: "/menu/acai_bowl.jpg" },
  { nombre: "French Toast Gourmet", img: "/menu/toastsweet.jpg" },
  { nombre: "Parfait de granola y frutos rojos", img: "/menu/parfait.jpg" },
];

const PASO = 360 / FAVORITOS.length; // grados entre un plato y el siguiente
const SEGUNDOS_POR_VUELTA = 70;

const sinMovimiento = () => globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

const Favorites = () => {
  const aroRef = useRef(null);
  const giroRef = useRef(null);
  const sobreElCarrusel = useRef(false);
  const [platos, setPlatos] = useState(FAVORITOS);
  const [volteado, setVolteado] = useState(null);

  useEffect(() => {
    let activo = true;
    listarProductos()
      .then((productos) => {
        if (!activo) return;
        const porNombre = new Map(productos.map((p) => [p.nombre, p]));
        setPlatos(
          FAVORITOS.map((fav) => {
            const real = porNombre.get(fav.nombre);
            return real
              ? { ...fav, img: real.img_url || fav.img, precio: real.precio, descripcion: real.descripcion }
              : fav;
          }),
        );
      })
      .catch(() => {}); // Sin carta, los favoritos se quedan con su foto y su nombre.
    return () => {
      activo = false;
    };
  }, []);

  // El aro gira solo, despacio. Los platos que quedan de espaldas se ocultan
  // para que no se vean al revés a través de los de adelante.
  useEffect(() => {
    const aro = aroRef.current;
    const tarjetas = [...aro.children];

    const ocultarLosDeAtras = () => {
      const angulo = Number(gsap.getProperty(aro, "rotationY"));
      tarjetas.forEach((tarjeta, i) => {
        const deEspaldas = Math.cos(((i * PASO + angulo) * Math.PI) / 180) < 0.05;
        tarjeta.classList.toggle("fav-card--atras", deEspaldas);
      });
    };

    // Con inicio y fin fijos: así una vuelta siempre va de 0° a -360°, aunque
    // el efecto se monte dos veces (modo estricto de React en desarrollo).
    const giro = gsap.fromTo(
      aro,
      { rotationY: 0 },
      {
        rotationY: -360,
        duration: SEGUNDOS_POR_VUELTA,
        repeat: -1,
        ease: "none",
        onUpdate: ocultarLosDeAtras,
      },
    );
    // Empieza varias vueltas adentro para que las flechas puedan ir hacia atrás.
    giro.totalTime(SEGUNDOS_POR_VUELTA * 50);
    if (sinMovimiento()) giro.timeScale(0);
    giroRef.current = giro;
    ocultarLosDeAtras();

    return () => {
      gsap.killTweensOf(giro);
      giro.kill();
    };
  }, []);

  // Se detiene con suavidad mientras el mouse está encima o hay un plato volteado.
  const ajustarGiro = (hayVolteado) => {
    const giro = giroRef.current;
    if (!giro || sinMovimiento()) return;
    const quieto = sobreElCarrusel.current || hayVolteado;
    gsap.to(giro, { timeScale: quieto ? 0 : 1, duration: 0.7, ease: "power2.out", overwrite: "auto" });
  };

  const voltear = (indice) => {
    const nuevo = volteado === indice ? null : indice;
    setVolteado(nuevo);
    ajustarGiro(nuevo !== null);
  };

  const mover = (pasos) => {
    const giro = giroRef.current;
    if (!giro) return;
    setVolteado(null);
    const porPaso = SEGUNDOS_POR_VUELTA / FAVORITOS.length;
    // Va al plato vecino exacto, aunque el aro estuviera a medio camino.
    const destino = (Math.round(giro.totalTime() / porPaso) + pasos) * porPaso;
    gsap.to(giro, { totalTime: destino, duration: 0.8, ease: "power3.out", overwrite: "auto" });
  };

  return (
    <section className="favorites-section">
      <div className="contenedor">
        <div className="fav-encabezado">
          <div>
            <h2 className="titulo-seccion">Los favoritos de la casa</h2>
            <p className="bajada">Toca un plato para ver de qué está hecho.</p>
          </div>
          <div className="fav-flechas">
            <button type="button" className="fav-flecha" onClick={() => mover(-1)} aria-label="Plato anterior">
              <ArrowLeft size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button type="button" className="fav-flecha" onClick={() => mover(1)} aria-label="Plato siguiente">
              <ArrowRight size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div
        className="fav-escena"
        onMouseEnter={() => {
          sobreElCarrusel.current = true;
          ajustarGiro(volteado !== null);
        }}
        onMouseLeave={() => {
          sobreElCarrusel.current = false;
          setVolteado(null);
          ajustarGiro(false);
        }}
      >
        <div className="fav-fondo">
          <ul className="fav-aro" ref={aroRef}>
            {platos.map((plato, i) => (
              <li
                key={plato.nombre}
                className={`fav-card${volteado === i ? " flipped" : ""}`}
                style={{ "--i": i }}
              >
                <div
                  className="fav-card-inner"
                  role="button"
                  tabIndex={0}
                  aria-pressed={volteado === i}
                  aria-label={`${plato.nombre}: ver detalles`}
                  onClick={() => voltear(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      voltear(i);
                    }
                  }}
                >
                  <div className="fav-cara fav-frente">
                    <img src={plato.img} alt="" loading="lazy" draggable="false" />
                    <span className="fav-nombre">{plato.nombre}</span>
                  </div>

                  <div className="fav-cara fav-dorso">
                    <h3>{plato.nombre}</h3>
                    {plato.precio != null && <p className="fav-precio">{formatearPrecio(plato.precio)}</p>}
                    <p className="fav-desc">{plato.descripcion || "Encuéntralo en nuestra carta."}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="contenedor fav-pie">
        <Link to="/menu" className="boton boton--primario">Ver la carta completa</Link>
      </div>
    </section>
  );
};

export default Favorites;
