import { useEffect, useState } from "react";
import "./WeatherBadge.css";

const API_KEY = "ad91376c322b5e62d181a5ecdf79b8ee";

const WeatherBadge = () => {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    fetch(
  `https://api.openweathermap.org/data/2.5/weather?q=Neiva,CO&appid=${API_KEY}&units=metric&lang=es`
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setWeather({
          temp: Math.round(data.main.temp),
          desc: data.weather[0].description,
        });
      })
      .catch(() => setWeather(null)); // Sin clima no se muestra nada
  }, []);

  if (!weather) return null;

  return (
    <div className="weather-badge">
      ☀️ {weather.temp}°C · {weather.desc}
    </div>
  );
};

export default WeatherBadge;