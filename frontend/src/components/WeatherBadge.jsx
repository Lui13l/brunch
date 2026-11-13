import { useEffect, useState } from "react";
import { Cloud, CloudRain, Sun } from "lucide-react";
import { LOCAL } from "../utils/horario";

const API_KEY = "ad91376c322b5e62d181a5ecdf79b8ee";

// Ícono según el estado que devuelve OpenWeather ("Clear", "Clouds", "Rain"...).
const ICONOS = { Clear: Sun, Clouds: Cloud, Rain: CloudRain, Drizzle: CloudRain, Thunderstorm: CloudRain };

// Un dato más de la portada: el clima de hoy en la ciudad del local.
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
          tipo: data.weather[0].main,
        });
      })
      .catch(() => setWeather(null)); // Sin clima no se muestra nada
  }, []);

  if (!weather) return null;

  const Icono = ICONOS[weather.tipo] || Sun;

  return (
    <li>
      <Icono size={16} strokeWidth={1.8} aria-hidden="true" />
      {weather.temp} °C en {LOCAL.ciudad}, {weather.desc}
    </li>
  );
};

export default WeatherBadge;
