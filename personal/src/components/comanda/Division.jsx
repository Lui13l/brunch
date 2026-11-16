import { Minus, Plus } from "lucide-react";
import { pesos } from "../../lib/formato";
import { MAX_PARTES, MAX_PERSONAS, METODOS_PAGO } from "../../lib/division";

const FORMAS = [
  { valor: "iguales", texto: "Partes iguales" },
  { valor: "platos", texto: "Por platos" },
];

// Dividir la cuenta: todos ponen lo mismo, o cada quien paga lo que pidió. En
// los dos casos cada persona elige cómo paga. El estado vive en el cobro, que
// es quien arma los pagos y decide si ya se puede confirmar.
export default function Division({ division, onCambiar, unidades, reparto }) {
  const porPlatos = division.forma === "platos";
  const maximo = porPlatos ? MAX_PERSONAS : MAX_PARTES;

  const cambiarForma = (forma) =>
    onCambiar({ ...division, forma, partes: Math.min(division.partes, forma === "platos" ? MAX_PERSONAS : MAX_PARTES) });
  const cambiarPartes = (delta) =>
    onCambiar({ ...division, partes: Math.min(maximo, Math.max(2, division.partes + delta)) });
  const asignar = (clave, persona) =>
    onCambiar({ ...division, asignacion: { ...division.asignacion, [clave]: persona } });
  const elegirMetodo = (indice, metodo) => {
    const metodos = [...division.metodos];
    metodos[indice] = metodo;
    onCambiar({ ...division, metodos });
  };

  const personas = Array.from({ length: division.partes }, (_, i) => i);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Forma de dividir">
        {FORMAS.map((forma) => (
          <button
            key={forma.valor}
            type="button"
            aria-pressed={division.forma === forma.valor}
            onClick={() => cambiarForma(forma.valor)}
            className={`min-h-12 rounded-xl px-3 text-[15px] font-bold pulsable ${
              division.forma === forma.valor ? "bg-tinta text-white" : "border border-filete bg-mantel text-tinta"
            }`}
          >
            {forma.texto}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-filete bg-mantel px-4 py-3">
        <p className="text-[17px] font-bold text-tinta">¿Entre cuántos?</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Una persona menos"
            disabled={division.partes <= 2}
            onClick={() => cambiarPartes(-1)}
            className="flex size-11 items-center justify-center rounded-lg border border-filete text-tinta disabled:opacity-40 pulsable"
          >
            <Minus size={20} aria-hidden />
          </button>
          <span className="w-8 text-center font-titulo text-3xl font-semibold text-tinta tabular-nums" aria-live="polite">
            {division.partes}
          </span>
          <button
            type="button"
            aria-label="Una persona más"
            disabled={division.partes >= maximo}
            onClick={() => cambiarPartes(1)}
            className="flex size-11 items-center justify-center rounded-lg border border-filete text-tinta disabled:opacity-40 pulsable"
          >
            <Plus size={20} aria-hidden />
          </button>
        </div>
      </div>

      {porPlatos && (
        <section aria-label="Quién paga cada plato">
          <h3 className="mb-2 flex items-baseline justify-between gap-3 text-[17px] font-bold text-tinta">
            ¿Quién paga cada plato?
            {reparto.sinRepartir > 0 && (
              <span className="text-[15px] font-semibold text-tinta-2">
                {reparto.sinRepartir === 1 ? "Falta 1" : `Faltan ${reparto.sinRepartir}`}
              </span>
            )}
          </h3>
          <ul className="overflow-hidden rounded-xl border border-filete bg-mantel">
            {unidades.map((unidad) => {
              const elegida = division.asignacion[unidad.clave];
              return (
                <li key={unidad.clave} className="border-b border-filete px-4 py-3 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[17px] font-semibold text-tinta">{unidad.nombre}</span>
                    <span className="shrink-0 text-[15px] text-tinta-2 tabular-nums">{pesos(unidad.precio)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Quién paga ${unidad.nombre}`}>
                    {personas.map((persona) => (
                      <button
                        key={persona}
                        type="button"
                        aria-label={`Persona ${persona + 1}`}
                        aria-pressed={elegida === persona}
                        onClick={() => asignar(unidad.clave, persona)}
                        className={`flex size-10 items-center justify-center rounded-lg text-[15px] font-bold tabular-nums pulsable ${
                          elegida === persona ? "bg-tinta text-white" : "border border-filete text-tinta"
                        }`}
                      >
                        {persona + 1}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-label="Cómo paga cada uno">
        <h3 className="mb-2 text-[17px] font-bold text-tinta">¿Cómo paga cada uno?</h3>
        <ul className="overflow-hidden rounded-xl border border-filete bg-mantel">
          {reparto.partes.map((parte) => (
            <li
              key={parte.indice}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-filete px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                {/* Los botones son solo iconos: el método elegido se lee aquí. */}
                <p className="text-[15px] font-semibold text-tinta-2">
                  {parte.etiqueta}
                  {parte.metodo && ` · ${METODOS_PAGO.find((m) => m.valor === parte.metodo)?.texto}`}
                </p>
                <p className="font-titulo text-2xl leading-tight font-semibold text-tinta tabular-nums">
                  {pesos(parte.monto)}
                </p>
              </div>
              {parte.monto > 0 ? (
                <div className="flex gap-1.5" role="group" aria-label={`Método de ${parte.etiqueta}`}>
                  {METODOS_PAGO.map((opcion) => (
                    <button
                      key={opcion.valor}
                      type="button"
                      title={opcion.texto}
                      aria-label={opcion.texto}
                      aria-pressed={parte.metodo === opcion.valor}
                      onClick={() => elegirMetodo(parte.indice, opcion.valor)}
                      className={`flex size-12 items-center justify-center rounded-lg pulsable ${
                        parte.metodo === opcion.valor ? "bg-tinta text-white" : "border border-filete text-tinta"
                      }`}
                    >
                      <opcion.Icono size={22} strokeWidth={1.8} aria-hidden />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[15px] text-tinta-2">Sin platos, no paga</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
