import { ArrowDown, Cloud, CloudRain, Sun } from "lucide-react";
import { useClima } from "../hooks/useClima";
import "./WeatherRecommendation.css";

const recommendations = {
  hot: {
    Icono: Sun,
    title: "Hoy hace calor: algo refrescante",
    text: "Smoothies, soda de café y bebidas frías.",
  },
  rain: {
    Icono: CloudRain,
    title: "Clima ideal para algo cálido",
    text: "Un latte caliente con nuestros pancakes.",
  },
  cold: {
    Icono: Cloud,
    title: "Un brunch acogedor siempre ayuda",
    text: "Eggs Benedict y café recién hecho.",
  },
};

// Sugerencia según el clima de hoy. El botón baja hasta las bebidas de la carta.
const elegir = (temp) => {
  if (temp >= 28) return recommendations.hot;
  if (temp <= 20) return recommendations.cold;
  return recommendations.rain;
};

const WeatherRecommendation = () => {
  const clima = useClima();

  const handleViewRecommended = () => {
    document.getElementById("bebidas")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!clima) return null; // Sin clima no se muestra nada
  const weather = elegir(clima.temperatura);

  return (
    <div className="weather-card">
      <span className="weather-icono" aria-hidden="true">
        <weather.Icono size={22} strokeWidth={1.7} />
      </span>

      <div className="weather-content">
        <p className="weather-title">{weather.title}</p>
        <p className="weather-text">{weather.text}</p>
      </div>

      <button type="button" className="boton boton--crema boton--chico weather-btn" onClick={handleViewRecommended}>
        Ver bebidas
        <ArrowDown size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
};

export default WeatherRecommendation;
