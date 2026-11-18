import { Cloud, CloudRain, Sun } from "lucide-react";
import { useClima } from "../hooks/useClima";
import { LOCAL } from "../utils/horario";

// Ícono según el tipo de clima que entrega el backend.
const ICONOS = { despejado: Sun, nublado: Cloud, lluvia: CloudRain };

// Un dato más de la portada: el clima de hoy en la ciudad del local.
const WeatherBadge = () => {
  const clima = useClima();

  if (!clima) return null; // Sin clima no se muestra nada

  const Icono = ICONOS[clima.tipo] || Sun;

  return (
    <li>
      <Icono size={16} strokeWidth={1.8} aria-hidden="true" />
      {clima.temperatura} °C en {LOCAL.ciudad}, {clima.descripcion}
    </li>
  );
};

export default WeatherBadge;
