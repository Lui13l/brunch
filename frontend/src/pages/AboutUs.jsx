import { Link } from "react-router-dom";
import { Heart, Leaf, Users } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import InstagramFeed from "../components/InstagramFeed";
import fotoNosotros from "../assets/foto_nosotros.jpeg";
import "./AboutUs.css";

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

const cifras = [
  { numero: "2018", texto: "Año de fundación" },
  { numero: "+8k", texto: "Clientes al mes" },
  { numero: "100%", texto: "Ingredientes frescos" },
];

const AboutUs = () => {
  return (
    <>
      <Navbar alRas />

      <main className="about-main">
        {/* ── Portada ── */}
        <section className="about-hero">
          <div className="contenedor about-hero-inner">
            <div className="about-hero-texto entrada-pagina">
              <h1 className="about-hero-title">Somos más que un brunch</h1>
              <p className="about-hero-sub">
                Un espacio donde el sabor, la calidez y el buen tiempo se encuentran cada mañana.
              </p>
              <div className="about-hero-acciones">
                <Link to="/reservas" className="boton boton--primario">Reservar mesa</Link>
                <Link to="/menu" className="boton boton--secundario">Ver el menú</Link>
              </div>
            </div>
            <img
              className="about-hero-foto"
              src={fotoNosotros}
              alt="Amigos compartiendo un brunch en la terraza de Brunch & Co."
            />
          </div>
        </section>

        {/* ── Historia ── */}
        <section className="about-story">
          <div className="contenedor about-story-inner">
            <h2 className="titulo-seccion">Un sueño que nació en una mesa familiar</h2>
            <div className="about-story-text">
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
          </div>

          <dl className="contenedor about-cifras">
            {cifras.map((c) => (
              <div className="about-stat" key={c.texto}>
                <dt className="about-stat-label">{c.texto}</dt>
                <dd className="about-stat-number">{c.numero}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Valores ── */}
        <section className="about-values">
          <div className="contenedor">
            <h2 className="titulo-seccion">Lo que nos mueve</h2>
            <ul className="about-values-grid">
              {values.map((v) => (
                <li className="about-value-card" key={v.title}>
                  <span className="about-value-icon" aria-hidden="true">
                    <v.Icon size={24} strokeWidth={1.6} />
                  </span>
                  <h3 className="about-value-title">{v.title}</h3>
                  <p className="about-value-desc">{v.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <InstagramFeed />

        {/* ── Promesa ── */}
        <section className="about-promise">
          <figure className="contenedor about-promise-inner">
            <blockquote className="about-promise-text">
              Queremos que cada visita sea un pequeño paréntesis en tu día: un momento para respirar,
              disfrutar y recordar por qué vale la pena tomarse el tiempo.
            </blockquote>
            <figcaption className="about-promise-attr">El equipo de Brunch & Co.</figcaption>
          </figure>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default AboutUs;
