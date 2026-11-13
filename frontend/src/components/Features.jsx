import { PawPrint, Sun, MapPin } from "lucide-react";
import "./Features.css";

const features = [
  {
    Icon: PawPrint,
    title: "Pet friendly",
    desc: "Tu mascota es bienvenida en nuestro jardín al aire libre.",
  },
  {
    Icon: Sun,
    title: "Abierto todo el día",
    desc: "Desayunos, brunch y meriendas a cualquier hora, sin mirar el reloj.",
  },
  {
    Icon: MapPin,
    title: "Ubicación céntrica",
    desc: "En el corazón de la ciudad, fácil de encontrar y de llegar.",
  },
];

const Features = () => {
  return (
    <section className="features-section">
      <div className="contenedor features-inner">
        <div className="features-header">
          <h2 className="titulo-seccion">Un lugar para quedarse un rato</h2>
          <p className="bajada">
            Ven a desayunar tarde, a trabajar con un café al lado o a alargar la sobremesa. Aquí nadie te apura.
          </p>
        </div>

        <ul className="features-lista">
          {features.map((f) => (
            <li className="feature-item" key={f.title}>
              <span className="feature-icono" aria-hidden="true">
                <f.Icon size={24} strokeWidth={1.6} />
              </span>
              <div>
                <h3 className="feature-titulo">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default Features;
