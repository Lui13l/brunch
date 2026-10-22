import { MapPin, Clock, Phone } from "lucide-react";
import "./MapSection.css";


const MapSection = () => (
  <section className="map-section">
          
    <div className="map-inner">

      <div className="map-info">
        <span className="map-eyebrow">Encuéntranos</span>
        <h2 className="map-title">¿Cómo llegar?</h2>
        <div className="map-divider">
          <span className="map-divider-line" />
          <span className="map-divider-gem">✦</span>
          <span className="map-divider-line map-divider-line--right" />
        </div>

        <ul className="map-details">
          <li>
            <span className="map-detail-icon"><MapPin size={16} strokeWidth={1.8} /></span>
            <span>Calle del Sabor 123, Ciudad del Brunch</span>
          </li>
          <li>
            <span className="map-detail-icon"><Clock size={16} strokeWidth={1.8} /></span>
            <span>
              Lun – Vie: 8:00 – 18:00<br />
              Sáb – Dom: 9:00 – 17:00
            </span>
          </li>
          <li>
            <span className="map-detail-icon"><Phone size={16} strokeWidth={1.8} /></span>
            <span>+57 000 000 0000</span>
          </li>
        </ul>
      </div>

      <div className="map-frame-wrap">
        <div className="map-pin-badge">
          <MapPin size={18} />
          <span>Brunch & Co.</span>
        </div>
        {/* Reemplaza el src con tu enlace de Google Maps → Compartir › Insertar mapa › copia la URL del iframe */}
        <iframe
          title="Ubicación Brunch & Co."
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
