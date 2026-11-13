import { MapPin, Clock, Phone, ArrowUpRight } from "lucide-react";
import { HORARIO, LOCAL } from "../utils/horario";
import "./MapSection.css";

// Mismo punto que muestra el mapa incrustado.
const COMO_LLEGAR = "https://www.google.com/maps/search/?api=1&query=2.9419992,-75.2998089";

const MapSection = () => (
  <section className="map-section">
    <div className="contenedor map-inner">
      <div className="map-info">
        <h2 className="titulo-seccion">Te esperamos</h2>

        <dl className="map-details">
          <div className="map-detail">
            <dt>
              <MapPin size={18} strokeWidth={1.8} aria-hidden="true" />
              Dirección
            </dt>
            <dd>{LOCAL.direccion}</dd>
          </div>
          <div className="map-detail">
            <dt>
              <Clock size={18} strokeWidth={1.8} aria-hidden="true" />
              Horario
            </dt>
            <dd>
              {HORARIO.semana.texto}, {HORARIO.semana.horas}
              <br />
              {HORARIO.finde.texto}, {HORARIO.finde.horas}
            </dd>
          </div>
          <div className="map-detail">
            <dt>
              <Phone size={18} strokeWidth={1.8} aria-hidden="true" />
              Teléfono
            </dt>
            <dd>
              <a href={`tel:${LOCAL.telefono.replace(/\s/g, "")}`}>{LOCAL.telefono}</a>
            </dd>
          </div>
        </dl>

        <a className="boton boton--secundario" href={COMO_LLEGAR} target="_blank" rel="noreferrer">
          Cómo llegar
          <ArrowUpRight size={18} strokeWidth={1.8} aria-hidden="true" />
        </a>
      </div>

      <div className="map-frame-wrap">
        {/* Reemplaza el src con tu enlace de Google Maps → Compartir › Insertar mapa › copia la URL del iframe */}
        <iframe
          title="Mapa con la ubicación de Brunch & Co."
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1976.7151893810776!2d-75.29980886146778!3d2.9419991992585817!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e3b74f438bb0299%3A0x3d63073da14eebf7!2sUniversidad%20Surcolombiana%20-%20Sede%20Central!5e1!3m2!1ses-419!2sco!4v1778195078633!5m2!1ses-419!2sco"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  </section>
);

export default MapSection;
