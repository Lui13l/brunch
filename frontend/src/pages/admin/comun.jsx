import { useEffect } from "react";
import { X } from "lucide-react";
import { rangoDias } from "./util";

// Piezas compartidas del panel de administración.

export function Aviso({ children, tipo = "error", onCerrar }) {
  if (!children) return null;
  return (
    <div className={`adm-aviso adm-aviso-${tipo}`} role={tipo === "error" ? "alert" : "status"}>
      <span>{children}</span>
      {onCerrar && (
        <button type="button" className="adm-aviso-cerrar" onClick={onCerrar} aria-label="Cerrar aviso">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function Cargando() {
  return <p className="adm-vacio">Cargando…</p>;
}

export function Vacio({ children }) {
  return <p className="adm-vacio">{children}</p>;
}

export function Chip({ children, tono = "neutro" }) {
  return <span className={`adm-chip adm-chip-${tono}`}>{children}</span>;
}

export function Encabezado({ titulo, descripcion, children }) {
  return (
    <div className="adm-encabezado">
      <div>
        <h2 className="adm-titulo">{titulo}</h2>
        {descripcion && <p className="adm-descripcion">{descripcion}</p>}
      </div>
      {children && <div className="adm-encabezado-acciones">{children}</div>}
    </div>
  );
}

// Ventana modal con el error dentro, para que no quede tapado.
export function Modal({ titulo, error, onCerrar, children }) {
  useEffect(() => {
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  return (
    <div className="modal is-active">
      <div className="modal-background" onClick={onCerrar} />
      <div className="modal-card adm-modal">
        <header className="modal-card-head">
          <p className="modal-card-title">{titulo}</p>
          <button type="button" className="delete" aria-label="Cerrar" onClick={onCerrar} />
        </header>
        <section className="modal-card-body">
          <Aviso>{error}</Aviso>
          {children}
        </section>
      </div>
    </div>
  );
}

export function Campo({ etiqueta, ayuda, children }) {
  return (
    <div className="field">
      <label className="label adm-label">
        {etiqueta}
        <div className="control">{children}</div>
      </label>
      {ayuda && <p className="help">{ayuda}</p>}
    </div>
  );
}

export function Selector({ etiqueta, opciones, value, onChange, ...props }) {
  return (
    <Campo etiqueta={etiqueta}>
      <div className="select is-fullwidth">
        <select value={value} onChange={(e) => onChange(e.target.value)} {...props}>
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
      </div>
    </Campo>
  );
}

export function RangoFechas({ rango, onCambiar }) {
  return (
    <div className="adm-rango">
      <Campo etiqueta="Desde">
        <input className="input" type="date" value={rango.desde} onChange={(e) => onCambiar({ ...rango, desde: e.target.value })} />
      </Campo>
      <Campo etiqueta="Hasta">
        <input className="input" type="date" value={rango.hasta} onChange={(e) => onCambiar({ ...rango, hasta: e.target.value })} />
      </Campo>
      <div className="adm-atajos">
        <button type="button" onClick={() => onCambiar(rangoDias(1))}>Hoy</button>
        <button type="button" onClick={() => onCambiar(rangoDias(7))}>7 días</button>
        <button type="button" onClick={() => onCambiar(rangoDias(30))}>30 días</button>
      </div>
    </div>
  );
}
