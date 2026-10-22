import { PawPrint, Sun, MapPin } from "lucide-react";
import "./Features.css";

const features = [
  {
    Icon: PawPrint,
    title: "Pet Friendly",
    desc: "Tu mascota es bienvenida en nuestro jardín al aire libre",
    accent: "#2e2622",
    bg: "#f2eeeb",
  },
  {
    Icon: Sun,
    title: "Abierto Todo el Día",
    desc: "Desayunos, brunch y meriendas a cualquier hora del día",
    accent: "#2e2622",
    bg: "#f2eeeb",
  },
  {
    Icon: MapPin,
    title: "Ubicación Céntrica",
    desc: "En el corazón de la ciudad, fácil de encontrar y llegar",
    accent: "#2e2622",
    bg: "#f2eeeb",
  },
];

const Features = () => {
  return (
    <section className="features-section">
      <div className="features-deco features-deco--tl">✿</div>
      <div className="features-deco features-deco--br">✿</div>

      <div className="features-header">
        <span className="features-eyebrow">¿Por qué elegirnos?</span>
        <h2 className="features-title">Una experiencia que va más allá</h2>
        <div className="features-divider">
          <span className="divider-line"></span>
          <span className="divider-gem">✦</span>
          <span className="divider-line divider-line--right"></span>
        </div>
      </div>

      <div className="features-grid">
        {features.map((f) => (
          <div
            className="feature-card"
            key={f.title}
            style={{ "--accent": f.accent, "--bg": f.bg }}
          >
            <div className="feature-icon-wrap">
              <f.Icon size={32} strokeWidth={1.4} color="#2e2622" />
            </div>
            <h3 className="feature-card-title">{f.title}</h3>
            <span className="feature-accent-line"></span>
            <p className="feature-card-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Features;
