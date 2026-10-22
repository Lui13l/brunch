import { useState, useEffect, useRef } from "react";
import SandwichFalling from "../components/SandwichFalling";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useCart } from "../context/CartContext";
import { api, formatearPrecio } from "../api";
import "./Menu.css";
import WeatherRecommendation from "../components/WeatherRecommendation";

gsap.registerPlugin(ScrollTrigger);

// "Desayunos Clásicos" -> "desayunos-clasicos" (se usa como id de la sección)
const slugCategoria = (nombre) =>
  nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

// Agrupa los productos de la API por categoría, respetando el orden de las categorías.
const agruparPorCategoria = (productos) => {
  const grupos = new Map();
  for (const producto of productos) {
    const categoria = producto.categoria_id;
    const clave = categoria?.id || "otros";
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        nombre: categoria?.nombre || "Otros",
        orden: categoria?.orden ?? Infinity,
        items: [],
      });
    }
    grupos.get(clave).items.push(producto);
  }
  return [...grupos.values()].sort((a, b) => a.orden - b.orden);
};

const FlipCard = ({ item, isFlipped, onFlip, itemId }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const { addToCart } = useCart();
  const cardRef = useRef(null);

  useEffect(() => {
    const card = cardRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Si la card sale del viewport, desfliparla
        if (!entry.isIntersecting && isFlipped) {
          onFlip(null);
        }
      },
      { threshold: 0 } // Se dispara cuando la card sale completamente del viewport
    );

    if (card) observer.observe(card);
    return () => observer.disconnect();
  }, [isFlipped, onFlip]);

  const handleClick = () => {
    if (isFlipped) {
      onFlip(null);
    } else {
      onFlip(itemId);
    }
  };

  const precio = formatearPrecio(item.precio);

  return (
    <div
      ref={cardRef}
      className={`flip-card${isFlipped ? " is-flipped" : ""}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isFlipped}
    >
      <div className="flip-inner">
        {/* ── Front ── */}
        <div className="flip-front">
          {item.img_url ? (
            <div className="flip-img-wrap">
              {!imgLoaded && <div className="flip-img-skeleton" />}
              <img
                src={item.img_url}
                alt={item.nombre}
                className={`flip-img${imgLoaded ? " flip-img--loaded" : ""}`}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
              />
            </div>
          ) : (
            <div className="flip-img-placeholder" />
          )}
          <div className="flip-front-info">
            <span className="menu-item-name">{item.nombre}</span>
            <span className="menu-item-price">{precio}</span>
          </div>
          <span className="flip-hint">Toca para ver más</span>
        </div>

        {/* ── Back ── */}
        <div className="flip-back">
          <p className="flip-back-label">✦</p>
          <h3 className="flip-back-name">{item.nombre}</h3>
          <p className="flip-back-price">{precio}</p>
          <p className="flip-back-desc">{item.descripcion}</p>
          <button
            className="flip-add-btn"
            onClick={(e) => { e.stopPropagation(); addToCart(item); }}
          >
            + Agregar al carrito
          </button>
        </div>
      </div>
    </div>
  );
};

const Menu = () => {
  const pageRef = useRef(null);
  const [flippedCardId, setFlippedCardId] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [estado, setEstado] = useState("cargando"); // cargando | listo | error

  const handleFlip = (cardId) => {
    setFlippedCardId(cardId);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    api
      .get("/productos")
      .then((productos) => {
        setCategorias(agruparPorCategoria(productos));
        setEstado("listo");
      })
      .catch(() => setEstado("error"));
  }, []);

  useEffect(() => {
    if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.from(".menu-hero-title", {
        y: 30, opacity: 0, duration: 0.55, ease: "power3.out",
      });
      gsap.from(".menu-hero-sub", {
        y: 18, opacity: 0, duration: 0.55, delay: 0.15, ease: "power3.out",
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  // Las tarjetas llegan desde la API, así que se animan cuando ya están en la página.
  useEffect(() => {
    if (categorias.length === 0) return;
    if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray(".menu-category-title").forEach((title) => {
        gsap.from(title, {
          scrollTrigger: { trigger: title, start: "top 85%", once: true },
          x: -20, opacity: 0, duration: 0.4, ease: "power2.out",
        });
      });

      ScrollTrigger.batch(".flip-card", {
        onEnter: (batch) =>
          gsap.fromTo(batch,
            { opacity: 0, y: 35 },
            { opacity: 1, y: 0, duration: 0.4, stagger: 0.07, ease: "power2.out" }
          ),
        start: "top 92%",
        once: true,
      });
    }, pageRef);

    const refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150);
    const onLoad = () => ScrollTrigger.refresh();
    globalThis.addEventListener("load", onLoad);

    return () => {
      ctx.revert();
      clearTimeout(refreshTimer);
      globalThis.removeEventListener("load", onLoad);
    };
  }, [categorias]);

  return (
    <div ref={pageRef}>
      <SandwichFalling heroSelector=".menu-hero" rightOffset={4} />
      <Navbar />

      <section className="menu-hero">
        <video className="menu-hero-video" autoPlay muted loop playsInline preload="metadata">
          <source src="https://res.cloudinary.com/dwhezsxkg/video/upload/v1778112262/menubrunch_xe5q9r.mp4" type="video/mp4" />
        </video>
        <div className="menu-hero-overlay">
          <div className="menu-hero-texts">
            <h1 className="menu-hero-title">Nuestro Menú</h1>
            <p className="menu-hero-sub">Ingredientes frescos, sabores que enamoran</p>
          </div>
          <WeatherRecommendation />
        </div>
      </section>

      <section className="section has-background-white">
        <div className="container">
          {estado === "cargando" && <p className="menu-estado">Cargando el menú...</p>}
          {estado === "error" && (
            <p className="menu-estado">
              No pudimos cargar el menú. Revisa tu conexión e inténtalo de nuevo.
            </p>
          )}
          {estado === "listo" && categorias.length === 0 && (
            <p className="menu-estado">Por ahora no hay productos disponibles.</p>
          )}

          {categorias.map((cat) => (
            <div key={cat.nombre} id={slugCategoria(cat.nombre)} className="menu-category">
              <h2 className="menu-category-title">{cat.nombre}</h2>
              <div className="divider" />
              <div className="columns is-multiline">
                {cat.items.map((item) => (
                  <div key={item.id} className="column is-4">
                    <FlipCard
                      item={item}
                      itemId={item.id}
                      isFlipped={flippedCardId === item.id}
                      onFlip={handleFlip}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Menu;
