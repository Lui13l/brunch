import { Heart, Leaf, Users } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "./AboutUs.css";
import InstagramFeed from "../components/InstagramFeed";


const values = [
  {
    Icon: Leaf,
    title: "Ingredientes frescos",
    desc: "Seleccionamos cada ingrediente con cuidado, priorizando productores locales y temporada.",
  },
  {
    Icon: Heart,
    title: "Hecho con amor",
    desc: "Cada plato lleva la dedicación de nuestro equipo, preparado como si fuera para nuestra propia familia.",
  },
  {
    Icon: Users,
    title: "Comunidad primero",
    desc: "Somos un punto de encuentro: un lugar donde las personas se reúnen, se reconectan y disfrutan.",
  },
];

const AboutUs = () => {
  return (
    <>
      <Navbar />

      {/* ── Hero ── */}
      <section className="about-hero">
        <div className="about-hero-inner">
          <span className="about-eyebrow">Nuestra historia</span>
          <h1 className="about-hero-title">Somos más<br />que un brunch</h1>
          <div className="about-hero-divider">
            <span className="about-divider-line" />
            <span className="about-divider-gem">✦</span>
            <span className="about-divider-line about-divider-line--right" />
          </div>
          <p className="about-hero-sub">
            Un espacio donde el sabor, la calidez y el buen tiempo se encuentran cada mañana.
          </p>
        </div>
      </section>

      <InstagramFeed />

      {/* ── Historia ── */}
      <section className="about-story">
        <div className="about-story-inner">
          <div className="about-story-text">
            <span className="about-eyebrow">Cómo empezamos</span>
            <h2 className="about-section-title">Un sueño que nació en una mesa familiar</h2>
            <p>
              Brunch & Co. nació de la idea sencilla de que el desayuno merece más tiempo, más sabor
              y más compañía. Lo que comenzó como reuniones de familia los fines de semana se
              convirtió en un espacio abierto para todos: un lugar donde la prisa no tiene lugar y
              cada taza de café se sirve con calma.
            </p>
            <p>
              Abrimos nuestras puertas con un menú honesto, preparado con ingredientes frescos y
              recetas propias que han pasado por varias generaciones. Hoy, cada plato que sale de
              nuestra cocina lleva esa misma intención: hacerte sentir en casa.
            </p>
          </div>

          <div className="about-story-aside">
            <div className="about-stat">
              <span className="about-stat-number">2018</span>
              <span className="about-stat-label">Año de fundación</span>
            </div>
            <div className="about-stat-sep" />
            <div className="about-stat">
              <span className="about-stat-number">+8k</span>
              <span className="about-stat-label">Clientes al mes</span>
            </div>
            <div className="about-stat-sep" />
            <div className="about-stat">
              <span className="about-stat-number">100%</span>
              <span className="about-stat-label">Ingredientes frescos</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Valores ── */}
      <section className="about-values">
        <div className="about-values-header">
          <span className="about-eyebrow">Lo que nos mueve</span>
          <h2 className="about-section-title">Nuestros valores</h2>
          <div className="about-hero-divider">
            <span className="about-divider-line" />
            <span className="about-divider-gem">✦</span>
            <span className="about-divider-line about-divider-line--right" />
          </div>
        </div>

        <div className="about-values-grid">
          {values.map((v) => (
            <div className="about-value-card" key={v.title}>
              <div className="about-value-icon">
                <v.Icon size={28} strokeWidth={1.4} color="#2e2622" />
              </div>
              <h3 className="about-value-title">{v.title}</h3>
              <p className="about-value-desc">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Promesa ── */}
      <section className="about-promise">
        <div className="about-promise-inner">
          <span className="about-promise-quote">"</span>
          <blockquote className="about-promise-text">
            Queremos que cada visita sea un pequeño paréntesis en tu día: un momento para respirar,
            disfrutar y recordar por qué vale la pena tomarse el tiempo.
          </blockquote>
          <p className="about-promise-attr">— El equipo de Brunch & Co.</p>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default AboutUs;
