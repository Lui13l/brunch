import { useState, useEffect, useRef } from "react";
import { Plus, RotateCcw } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SandwichFalling from "../components/SandwichFalling";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PortadaPagina from "../components/PortadaPagina";
import WeatherRecommendation from "../components/WeatherRecommendation";
import { useCart } from "../context/CartContext";
import { formatearPrecio } from "../utils/formato";
import { listarProductos } from "../services/menuService";
import "./Menu.css";

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
  return [...grupos.values()]
    .sort((a, b) => a.orden - b.orden)
    .map((grupo) => ({ ...grupo, slug: slugCategoria(grupo.nombre) }));
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

  const agregar = (e) => {
    e.stopPropagation();
    addToCart(item);
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
      aria-label={`${item.nombre}, ${precio}. ${isFlipped ? "Ocultar" : "Ver"} descripción`}
    >
      <div className="flip-inner">
        {/* ── Frente ── */}
        <div className="flip-front" inert={isFlipped}>
          <div className="flip-img-wrap">
            {item.img_url ? (
              <>
                {!imgLoaded && <div className="flip-img-skeleton esqueleto" />}
                <img
                  src={item.img_url}
                  alt=""
                  className={`flip-img${imgLoaded ? " flip-img--loaded" : ""}`}
                  loading="lazy"
                  onLoad={() => setImgLoaded(true)}
                />
              </>
            ) : (
              <div className="flip-img-placeholder" />
            )}
          </div>
          <div className="flip-front-info">
            <h3 className="menu-item-name">{item.nombre}</h3>
            {item.descripcion && <p className="menu-item-desc">{item.descripcion}</p>}
            <div className="flip-front-pie">
              <span className="menu-item-price">{precio}</span>
              <button
                type="button"
                className="flip-add-rapido"
                onClick={agregar}
                aria-label={`Agregar ${item.nombre} al pedido`}
                title="Agregar al pedido"
              >
                <Plus size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Dorso ── */}
        <div className="flip-back" inert={!isFlipped}>
          <h3 className="flip-back-name">{item.nombre}</h3>
          <p className="flip-back-price">{precio}</p>
          <p className="flip-back-desc">{item.descripcion}</p>
          <button type="button" className="boton boton--crema boton--ancho flip-add-btn" onClick={agregar}>
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
            Agregar al pedido
          </button>
          <span className="flip-back-volver">
            <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
            Toca para volver
          </span>
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
  const [categoriaActiva, setCategoriaActiva] = useState(null);

  const handleFlip = (cardId) => {
    setFlippedCardId(cardId);
  };

  // Cada reintento vuelve a pedir la carta.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    listarProductos()
      .then((productos) => {
        if (!activo) return;
        setCategorias(agruparPorCategoria(productos));
        setEstado("listo");
      })
      .catch(() => {
        if (activo) setEstado("error");
      });
    return () => {
      activo = false;
    };
  }, [intento]);

  const reintentar = () => {
    setEstado("cargando");
    setIntento((n) => n + 1);
  };

  // Marca en la barra de categorías la sección que se está leyendo.
  useEffect(() => {
    if (categorias.length === 0) return undefined;

    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.find((entrada) => entrada.isIntersecting);
        if (visible) setCategoriaActiva(visible.target.id);
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    pageRef.current.querySelectorAll(".menu-category").forEach((seccion) => observador.observe(seccion));
    return () => observador.disconnect();
  }, [categorias]);

  // Las tarjetas llegan desde la API, así que se animan cuando ya están en la página.
  useEffect(() => {
    if (categorias.length === 0) return undefined;
    if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const ctx = gsap.context(() => {
      ScrollTrigger.batch(".flip-card", {
        onEnter: (batch) =>
          gsap.fromTo(batch,
            { opacity: 0, y: 28 },
            { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out", clearProps: "transform" }
          ),
        start: "top 94%",
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

  const irACategoria = (slug) => {
    document.getElementById(slug)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={pageRef}>
      <SandwichFalling heroSelector=".menu-hero" rightOffset={4} />
      <Navbar sobreFoto />

      <PortadaPagina
        className="menu-hero"
        titulo="Nuestro menú"
        bajada="Ingredientes frescos y recetas de la casa. Pide a domicilio o ven a probarlo a la mesa."
      >
        <WeatherRecommendation />
      </PortadaPagina>

      {categorias.length > 1 && (
        <nav className="menu-categorias" aria-label="Categorías del menú">
          <div className="contenedor menu-categorias-lista">
            {categorias.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                className={`menu-chip${categoriaActiva === cat.slug ? " menu-chip--activo" : ""}`}
                aria-current={categoriaActiva === cat.slug ? "true" : undefined}
                onClick={() => irACategoria(cat.slug)}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="menu-main">
        <div className="contenedor">
          {estado === "cargando" && (
            <div className="menu-grid" role="status" aria-label="Cargando el menú">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="menu-card-esqueleto">
                  <div className="esqueleto" />
                  <span className="esqueleto" />
                  <span className="esqueleto" />
                </div>
              ))}
            </div>
          )}
          {estado === "error" && (
            <div className="menu-estado">
              <p>No pudimos cargar el menú. Revisa tu conexión e inténtalo de nuevo.</p>
              <button type="button" className="boton boton--secundario" onClick={reintentar}>
                Volver a intentar
              </button>
            </div>
          )}
          {estado === "listo" && categorias.length === 0 && (
            <div className="menu-estado">
              <p>Por ahora no hay productos disponibles.</p>
            </div>
          )}

          {categorias.map((cat) => (
            <section key={cat.slug} id={cat.slug} className="menu-category" aria-labelledby={`titulo-${cat.slug}`}>
              <div className="menu-category-header">
                <h2 id={`titulo-${cat.slug}`} className="menu-category-title">{cat.nombre}</h2>
                <span className="menu-category-count">
                  {cat.items.length} {cat.items.length === 1 ? "opción" : "opciones"}
                </span>
              </div>
              <div className="menu-grid">
                {cat.items.map((item) => (
                  <FlipCard
                    key={item.id}
                    item={item}
                    itemId={item.id}
                    isFlipped={flippedCardId === item.id}
                    onFlip={handleFlip}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Menu;
