import { useState } from "react";

// Gráficas de barras de los reportes. Sin librerías: son pocas barras y así
// usan los mismos colores y la misma tipografía que el resto de la app.
//
// Reglas que siguen las dos:
//  - Una sola serie, un solo color (caramelo). El texto nunca lleva el color
//    de la barra: los valores van en tinta para que se lean bien.
//  - La barra es delgada, con la punta redondeada y la base recta.
//  - Cada barra responde al mouse, al dedo y al teclado con su detalle.
//  - La tabla con todos los números sigue debajo, en "Ver en tabla".

// El tope del eje: el siguiente número redondo por encima del valor más alto.
const topeRedondo = (maximo) => {
  if (maximo <= 0) return 1;
  const escala = 10 ** Math.floor(Math.log10(maximo));
  const pasos = [1, 2, 2.5, 5, 10];
  return pasos.map((p) => p * escala).find((t) => t >= maximo) ?? 10 * escala;
};

// Detalle que aparece al señalar una barra. El valor manda; la etiqueta acompaña.
function Detalle({ etiqueta, valor, extra, className = "" }) {
  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute z-10 w-max max-w-56 rounded-lg bg-tinta px-3 py-2 text-left shadow-lg ${className}`}
    >
      <span className="block text-[15px] font-extrabold text-white tabular-nums">{valor}</span>
      <span className="block text-[13px] font-semibold text-white/75">{etiqueta}</span>
      {extra && <span className="block text-[13px] text-white/75">{extra}</span>}
    </span>
  );
}

/**
 * Barras horizontales para comparar categorías (platos, métodos de pago,
 * insumos). Ordenadas como lleguen: el reporte ya las trae de mayor a menor.
 *
 * @param filas [{ clave, etiqueta, valor, texto, extra?, nota? }]
 *   `texto` es el valor ya formateado; `nota` es un aviso en palabras bajo la
 *   etiqueta (por ejemplo "Stock en negativo"), nunca solo un color.
 */
export function BarrasHorizontales({ filas, titulo }) {
  const [activa, setActiva] = useState(null);
  const tope = Math.max(...filas.map((f) => f.valor), 0) || 1;

  return (
    <ul aria-label={titulo} className="space-y-1">
      {filas.map((fila) => {
        const senalada = activa === fila.clave;
        return (
          <li key={fila.clave}>
            <button
              type="button"
              onPointerEnter={() => setActiva(fila.clave)}
              onPointerLeave={() => setActiva(null)}
              onFocus={() => setActiva(fila.clave)}
              onBlur={() => setActiva(null)}
              className={`relative grid w-full grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 rounded-lg px-2 py-2 text-left sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] ${
                senalada ? "bg-sala" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-tinta">{fila.etiqueta}</span>
                {fila.nota && <span className="block text-[13px] font-bold text-brasa">{fila.nota}</span>}
              </span>

              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`h-4 shrink-0 rounded-r-[4px] transition-colors ${senalada ? "bg-rio" : "bg-caramelo"}`}
                  // Se reserva sitio para el valor al final; el resto se reparte en
                  // proporción. Una barra con valor siempre se ve, aunque sea diminuta.
                  style={{ width: `max(${fila.valor > 0 ? 3 : 0}px, calc((100% - 6.5rem) * ${fila.valor / tope}))` }}
                />
                <span className="shrink-0 text-[15px] font-bold text-tinta tabular-nums">{fila.texto}</span>
              </span>

              {senalada && fila.extra && (
                <Detalle etiqueta={fila.etiqueta} valor={fila.texto} extra={fila.extra} className="top-full right-2 -mt-1" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Columnas para una serie en el tiempo (ventas por día). Solo se rotula el
 * día más alto; el resto se lee con el eje o señalando la columna.
 *
 * @param columnas [{ clave, etiqueta, valor, texto, extra? }]
 * @param formatoEje Cómo escribir los números del eje (compactos).
 */
export function Columnas({ columnas, titulo, formatoEje }) {
  const [activa, setActiva] = useState(null);
  const maximo = Math.max(...columnas.map((c) => c.valor), 0);
  const tope = topeRedondo(maximo);
  const marcas = [1, 0.5, 0];
  const mayor = columnas.find((c) => c.valor === maximo)?.clave;

  return (
    <div role="group" aria-label={titulo} className="flex gap-2">
      {/* Eje: tres números redondos bastan para leer la altura. */}
      <div className="flex h-44 flex-col justify-between text-right text-[12px] font-semibold text-tinta-2 tabular-nums" aria-hidden>
        {marcas.map((m) => (
          <span key={m} className="leading-none">
            {formatoEje(tope * m)}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative h-44">
          {marcas.map((m) => (
            <span
              key={m}
              aria-hidden
              className={`absolute inset-x-0 border-t ${m === 0 ? "border-tinta-2/50" : "border-filete"}`}
              style={{ bottom: `${m * 100}%` }}
            />
          ))}

          <div className="absolute inset-0 flex items-end">
            {columnas.map((col, i) => {
              const senalada = activa === col.clave;
              return (
                <button
                  key={col.clave}
                  type="button"
                  aria-label={`${col.etiqueta}: ${col.texto}`}
                  onPointerEnter={() => setActiva(col.clave)}
                  onPointerLeave={() => setActiva(null)}
                  onFocus={() => setActiva(col.clave)}
                  onBlur={() => setActiva(null)}
                  className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                >
                  {col.clave === mayor && !senalada && (
                    <span className="mb-1 text-[13px] font-bold whitespace-nowrap text-tinta tabular-nums">{col.texto}</span>
                  )}
                  <span
                    className={`w-full max-w-6 rounded-t-[4px] transition-colors ${senalada ? "bg-rio" : "bg-caramelo"}`}
                    style={{ height: `${(col.valor / tope) * 100}%`, minHeight: col.valor > 0 ? 3 : 0 }}
                  />
                  {senalada && (
                    <Detalle
                      etiqueta={col.etiqueta}
                      valor={col.texto}
                      extra={col.extra}
                      // Las primeras columnas abren el detalle hacia la derecha y las últimas hacia la izquierda.
                      className={`bottom-full mb-1 ${i < columnas.length / 2 ? "left-0" : "right-0"}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-1.5 flex" aria-hidden>
          {columnas.map((col) => (
            <span key={col.clave} className="min-w-0 flex-1 truncate text-center text-[12px] font-semibold text-tinta-2">
              {col.etiquetaCorta ?? col.etiqueta}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
