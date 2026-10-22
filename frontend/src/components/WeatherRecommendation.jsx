import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./WeatherRecommendation.css";

const API_KEY = "ad91376c322b5e62d181a5ecdf79b8ee";

const recommendations = {
  hot: {
    emoji: "☀️",
    theme: "weather-hot",
    title: "Perfecto para algo refrescante",
    text: "Hoy recomendamos smoothies, soda de café y bebidas frías.",
  },

  rain: {
    emoji: "🌧️",
    theme: "weather-rain",
    title: "Clima ideal para algo cálido",
    text: "Un latte caliente y nuestros pancakes son la combinación perfecta.",
  },

  cold: {
    emoji: "☁️",
    theme: "weather-cold",
    title: "Un brunch acogedor siempre ayuda",
    text: "Prueba nuestros Eggs Benedict y café artesanal.",
  },
};

const WeatherRecommendation = () => {
  const [weather, setWeather] = useState(null);
  const navigate = useNavigate();

  const handleViewRecommended = () => {
    navigate("/menu");
    // Desplazarse a la sección de Bebidas después de navegar
    setTimeout(() => {
      const bebidasSection = document.getElementById("bebidas");
      if (bebidasSection) {
        bebidasSection.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
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
  <section className="weather-section">

    <div className={`weather-card ${weather.theme}`}> 

      <div className="weather-left">

        <span className="weather-emoji">
          {weather.emoji}
        </span>

        <div className="weather-content">

          <h2 className="weather-title">
            {weather.title}
          </h2>

          <p className="weather-text">
            {weather.text}
          </p>

        </div>

      </div>

      <button className="weather-btn" onClick={handleViewRecommended}>
        Ver recomendados
      </button>

    </div>

  </section>
);
};

export default WeatherRecommendation;