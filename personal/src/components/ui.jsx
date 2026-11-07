import { Loader2, X } from "lucide-react";
import { useEffect } from "react";
import { COLOR_ESTADO, ETIQUETA_ESTADO, rangoDias } from "../lib/formato";

// Piezas compartidas.
//
// Dos reglas que ordenan este archivo:
//  - Todo lo pulsable mide al menos 48px: se usa con el dedo, con prisa y a
//    veces con las manos ocupadas.
//  - El radio distingue el papel de cada pieza: las baldosas (mesas, tickets)
//    son generosas, los controles son firmes y las filas de una cuenta no
//    llevan radio porque no son tarjetas, son renglones.

const VARIANTES = {
  primario: "bg-tinta text-white active:bg-rio-hondo disabled:bg-filete disabled:text-tinta-2",
  secundario: "bg-mantel text-tinta border border-filete active:bg-sala disabled:text-tinta-2",
  peligro: "bg-brasa text-white active:brightness-90 disabled:bg-filete disabled:text-tinta-2",
  dorado: "bg-rio text-white active:bg-rio-hondo disabled:bg-filete disabled:text-tinta-2",
  // "marca" se usa en Entregar, Cobrar y Cerrar caja; antes no existía y esos botones salían sin estilo.
  marca: "bg-rio text-white active:bg-rio-hondo disabled:bg-filete disabled:text-tinta-2",
};

export function Boton({ variante = "primario", cargando = false, className = "", children, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || cargando}
      className={`min-h-12 rounded-lg px-5 text-[15px] font-bold tracking-[-0.01em] transition disabled:cursor-not-allowed ${VARIANTES[variante]} ${className}`}
    >
      {cargando ? <Loader2 className="mx-auto animate-spin" size={20} /> : children}
    </button>
  );
}

export function Cargando({ texto = "Cargando" }) {
  return (
    <div className="flex items-center justify-center gap-3 p-12 text-tinta-2">
      <Loader2 className="animate-spin" size={20} />
      {texto}
    </div>
  );
}

// Un error dice qué pasó y cómo salir de ahí. No se disculpa.
export function Aviso({ children, onReintentar, className = "m-4" }) {
  if (!children) return null;
  return (
    <div className={`border-l-4 border-brasa bg-brasa/8 px-4 py-3 text-brasa ${className}`}>
      <p className="font-semibold">{children}</p>
      {onReintentar && (
        <button onClick={onReintentar} className="mt-1 font-bold underline underline-offset-2">
          Reintentar
        </button>
      )}
    </div>
  );
}

// Una pantalla vacía es una invitación a actuar, no un hueco.
export function Vacio({ children }) {
  return <p className="px-6 py-14 text-center text-lg text-tinta-2">{children}</p>;
}

export function Estado({ valor, etiquetas = ETIQUETA_ESTADO, colores = COLOR_ESTADO }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[13px] font-bold ${colores[valor] ?? "bg-espera text-tinta-2"}`}>
      {etiquetas[valor] ?? valor}
    </span>
  );
}

// Desde / hasta con los atajos que de verdad se piden: hoy, 7 y 30 días.
export function RangoFechas({ rango, onCambiar }) {
  return (
    <div className="mb-4 rounded-xl border border-filete bg-white p-3">
      <div className="flex gap-2">
        <Campo
          etiqueta="Desde"
          type="date"
          className="min-w-0 flex-1"
          value={rango.desde}
          onChange={(e) => onCambiar({ ...rango, desde: e.target.value })}
        />
        <Campo
          etiqueta="Hasta"
          type="date"
          className="min-w-0 flex-1"
          value={rango.hasta}
          onChange={(e) => onCambiar({ ...rango, hasta: e.target.value })}
        />
      </div>
      <div className="mt-2 flex gap-4 text-sm">
        <button onClick={() => onCambiar(rangoDias(1))} className="min-h-10 text-tinta-2 underline">
          Hoy
        </button>
        <button onClick={() => onCambiar(rangoDias(7))} className="min-h-10 text-tinta-2 underline">
          7 días
        </button>
        <button onClick={() => onCambiar(rangoDias(30))} className="min-h-10 text-tinta-2 underline">
          30 días
        </button>
      </div>
    </div>
  );
}

// --- Formularios ---

const CONTROL =
  "min-h-12 w-full rounded-lg border border-filete bg-mantel px-3 text-[17px] text-tinta outline-none focus:border-rio";

export function Campo({ etiqueta, ayuda, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-semibold text-tinta-2">{etiqueta}</span>
      <input {...props} className={CONTROL} />
      {ayuda && <span className="mt-1 block text-[13px] text-tinta-2">{ayuda}</span>}
    </label>
  );
}

export function AreaTexto({ etiqueta, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-semibold text-tinta-2">{etiqueta}</span>
      <textarea {...props} className={`${CONTROL} min-h-24 py-2`} />
    </label>
  );
}

export function Selector({ etiqueta, opciones, ayuda, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-semibold text-tinta-2">{etiqueta}</span>
      <select {...props} className={CONTROL}>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      {ayuda && <span className="mt-1 block text-[13px] text-tinta-2">{ayuda}</span>}
    </label>
  );
}

export function Casilla({ etiqueta, ayuda, ...props }) {
  return (
    <label className="flex min-h-12 items-center gap-3">
      <input type="checkbox" {...props} className="size-5 accent-rio" />
      <span>
        <span className="font-semibold text-tinta">{etiqueta}</span>
        {ayuda && <span className="block text-[13px] text-tinta-2">{ayuda}</span>}
      </span>
    </label>
  );
}

// Formularios en panel deslizante: abajo en el celular, centrado en pantalla
// grande. El error se pinta aquí dentro: si se quedara en la página, el panel
// lo taparía y el usuario vería que su botón "no hace nada".
export function Hoja({ titulo, error, onCerrar, children }) {
  useEffect(() => {
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center">
      <button aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-tinta/50" />
      <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-mantel sm:max-w-lg sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-filete bg-mantel px-5 py-4">
          <h2 className="text-xl font-extrabold tracking-[-0.02em] text-tinta">{titulo}</h2>
          <button onClick={onCerrar} className="-mr-2 flex size-10 items-center justify-center rounded-lg text-tinta-2">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">
          <Aviso className="mb-4">{error}</Aviso>
          {children}
        </div>
      </div>
    </div>
  );
}
