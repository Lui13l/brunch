import { useEffect, useState } from "react";
import { ArrowDown, Cloud, CloudRain, Sun } from "lucide-react";
import "./WeatherRecommendation.css";

const API_KEY = "ad91376c322b5e62d181a5ecdf79b8ee";

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
const WeatherRecommendation = () => {
  const [weather, setWeather] = useState(null);

  const handleViewRecommended = () => {
    document.getElementById("bebidas")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=Neiva,CO&appid=${API_KEY}&units=metric&lang=es`
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const temp = data.main.temp;

        if (temp >= 28) {
          setWeather(recommendations.hot);
        } else if (temp <= 20) {
          setWeather(recommendations.cold);
        } else {
          setWeather(recommendations.rain);
        }
      })
      .catch(() => setWeather(null)); // Sin clima no se muestra nada
  }, []);

  if (!weather) return null;

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
