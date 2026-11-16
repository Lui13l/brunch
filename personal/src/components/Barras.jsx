import { useState } from "react";

// Gráficas de los reportes: barras para comparar categorías y una línea para
// ver una serie en el tiempo. Sin librerías: son pocos datos y así usan los
// mismos colores y la misma tipografía que el resto de la app.
//
// Reglas que siguen las dos:
//  - Una sola serie, un solo color (caramelo). El texto nunca lleva el color
//    de la marca: los valores van en tinta para que se lean bien.
//  - La barra es delgada, con la punta apenas redondeada y la base recta; la
//    línea mide 2 px y sus puntos llevan un borde claro que los separa de ella.
//  - Cada marca responde al mouse, al dedo y al teclado con su detalle; al
//    señalar una barra, las demás se apagan para que el ojo no tenga que buscarla.
//  - Las guías y el eje van en gris: acompañan, no compiten con los datos.
//  - La tabla con todos los números sigue debajo, en "Ver en tabla".

// El tope del eje: el siguiente número redondo por encima del valor más alto.
const topeRedondo = (maximo) => {
  if (maximo <= 0) return 1;
  const escala = 10 ** Math.floor(Math.log10(maximo));
  const pasos = [1, 2, 2.5, 5, 10];
  return pasos.map((p) => p * escala).find((t) => t >= maximo) ?? 10 * escala;
};

// Detalle que aparece al señalar una barra o un punto. El valor manda; la etiqueta acompaña.
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
 * @param tope  Valor que llena la pista. Por defecto, la fila más alta. Con
 *   proporciones (0 a 1) se pasa 1 para que media barra sea de verdad la mitad.
 * @param total Si se pasa, cada fila dice qué parte del total representa.
 */
export function BarrasHorizontales({ filas, titulo, tope: topeFijo, total }) {
  const [activa, setActiva] = useState(null);
  const tope = topeFijo ?? (Math.max(...filas.map((f) => f.valor), 0) || 1);

  return (
    <ul aria-label={titulo} className="space-y-0.5">
      {filas.map((fila, i) => {
        const senalada = activa === fila.clave;
        const apagada = activa !== null && !senalada;
        return (
          <li key={fila.clave}>
            <button
              type="button"
              data-sin-hover
              onPointerEnter={() => setActiva(fila.clave)}
              onPointerLeave={() => setActiva(null)}
              onFocus={() => setActiva(fila.clave)}
              onBlur={() => setActiva(null)}
              className={`relative grid w-full grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] ${
                senalada ? "bg-sala" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-tinta">{fila.etiqueta}</span>
                {fila.nota && <span className="block text-[13px] font-bold text-brasa">{fila.nota}</span>}
              </span>

              {/* La pista muestra hasta dónde podría llegar la barra: así se lee
                  la proporción sin eje. */}
              <span className="h-4 min-w-0 overflow-hidden rounded-r-[3px] bg-espera" aria-hidden>
                <span
                  className={`block h-full origin-left animate-[barra-avanza_420ms_ease-out_both] rounded-r-[3px] transition-[background-color,opacity] ${
                    senalada ? "bg-rio" : "bg-caramelo"
                  } ${apagada ? "opacity-45" : ""}`}
                  // Una barra con valor siempre se ve, aunque sea diminuta.
                  style={{
                    width: `max(${fila.valor > 0 ? 3 : 0}px, ${Math.min(fila.valor / tope, 1) * 100}%)`,
                    animationDelay: `${Math.min(i, 12) * 30}ms`,
                  }}
                />
              </span>

              <span className="min-w-[5.5rem] shrink-0 text-right">
                <span className="block text-[15px] font-bold text-tinta tabular-nums">{fila.texto}</span>
                {total > 0 && (
                  <span className="block text-[12px] font-semibold text-tinta-2 tabular-nums">
                    {Math.round((fila.valor / total) * 100)} % del total
                  </span>
                )}
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

// Con muchos días no cabe un rótulo por punto: se rotula uno de cada tantos.
const pasoDeRotulos = (cuantas) => (cuantas <= 10 ? 1 : cuantas <= 20 ? 2 : Math.ceil(cuantas / 8));

// Con más puntos que estos, los marcadores se pisan: se dibuja solo la línea y
// el punto aparece al señalar.
const MAX_MARCADORES = 31;

/**
 * Línea con puntos para una serie en el tiempo (ventas por día). Una línea
 * deja ver la tendencia, que es lo que se busca al mirar varios días seguidos;
 * los puntos marcan cada día medido. Solo se rotula el día más alto; el resto
 * se lee con el eje o señalando el punto. Una línea punteada marca el
 * promedio: dice de un vistazo qué días estuvieron por encima y cuáles por
 * debajo.
 *
 * @param puntos [{ clave, etiqueta, etiquetaCorta?, valor, texto, extra? }]
 * @param formatoEje Cómo escribir los números del eje (compactos).
 * @param cada Qué representa cada punto ("día", "mes"), para rotular el promedio.
 */
export function Linea({ puntos, titulo, formatoEje, cada = "día" }) {
  const [activa, setActiva] = useState(null);
  const maximo = Math.max(...puntos.map((p) => p.valor), 0);
  const tope = topeRedondo(maximo);
  const marcas = [1, 0.75, 0.5, 0.25, 0];
  const mayor = puntos.find((p) => p.valor === maximo)?.clave;
  const promedio = puntos.length > 0 ? puntos.reduce((suma, p) => suma + p.valor, 0) / puntos.length : 0;
  const paso = pasoDeRotulos(puntos.length);
  const conMarcadores = puntos.length <= MAX_MARCADORES;

  // Cada punto va al centro de su franja: así coincide con su rótulo de abajo
  // y con la zona que responde al mouse. En porcentajes del área de la gráfica.
  const lugares = puntos.map((p, i) => ({
    ...p,
    x: ((i + 0.5) / puntos.length) * 100,
    y: 100 - (p.valor / tope) * 100,
  }));
  const trazo = lugares.map((l, i) => `${i === 0 ? "M" : "L"}${l.x} ${l.y}`).join(" ");
  const relleno = `${trazo} L${lugares.at(-1).x} 100 L${lugares[0].x} 100 Z`;
  const senalado = lugares.find((l) => l.clave === activa);

  return (
    <figure aria-label={titulo} className="m-0">
      <div className="flex gap-2">
        {/* Eje: cinco números redondos. */}
        <div
          className="flex h-52 flex-col justify-between text-right text-[12px] font-semibold text-tinta-2 tabular-nums"
          aria-hidden
        >
          {marcas.map((m) => (
            <span key={m} className="leading-none">
              {formatoEje(tope * m)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-52">
            {marcas.map((m) => (
              <span
                key={m}
                aria-hidden
                className={`absolute inset-x-0 border-t ${m === 0 ? "border-tinta-2/60" : "border-filete/70"}`}
                style={{ bottom: `${m * 100}%` }}
              />
            ))}

            {promedio > 0 && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-tinta/45"
                style={{ bottom: `${(promedio / tope) * 100}%` }}
              />
            )}

            {/* La línea y su sombra se estiran con el contenedor; el grosor del
                trazo no (vectorEffect), para que siga midiendo 2 px. */}
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 size-full animate-[linea-entra_650ms_ease-out_both] overflow-visible"
            >
              <path d={relleno} className="fill-caramelo/12" />
              <path
                d={trazo}
                fill="none"
                className="stroke-caramelo"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Guía vertical del punto señalado. */}
            {senalado && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-tinta/35"
                style={{ left: `${senalado.x}%` }}
              />
            )}

            {/* Los marcadores van en HTML para que sigan redondos aunque la
                gráfica se estire. El borde claro los separa de la línea. */}
            {lugares.map((l) => {
              const es = l.clave === activa;
              if (!conMarcadores && !es) return null;
              return (
                <span
                  key={l.clave}
                  aria-hidden
                  className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-mantel transition-[width,height,background-color] duration-100 ${
                    es ? "size-4 bg-rio" : "size-[10px] bg-caramelo"
                  }`}
                  style={{ left: `${l.x}%`, top: `${l.y}%` }}
                />
              );
            })}

            {activa === null && lugares.filter((l) => l.clave === mayor).map((l) => (
              <span
                key={l.clave}
                aria-hidden
                className="pointer-events-none absolute -translate-x-1/2 text-[13px] font-bold whitespace-nowrap text-tinta tabular-nums"
                style={{ left: `clamp(2.5rem, ${l.x}%, calc(100% - 2.5rem))`, top: `calc(${l.y}% - 1.75rem)` }}
              >
                {l.texto}
              </span>
            ))}

            {/* Lo que responde al mouse, al dedo y al teclado es la franja
                entera de cada punto, no el punto: es más fácil de acertar. */}
            <div className="absolute inset-0 flex">
              {lugares.map((l, i) => (
                <button
                  key={l.clave}
                  type="button"
                  data-sin-hover
                  aria-label={`${l.etiqueta}: ${l.texto}`}
                  onPointerEnter={() => setActiva(l.clave)}
                  onPointerLeave={() => setActiva(null)}
                  onFocus={() => setActiva(l.clave)}
                  onBlur={() => setActiva(null)}
                  className="relative h-full min-w-0 flex-1 cursor-default"
                >
                  {activa === l.clave && (
                    <Detalle
                      etiqueta={l.etiqueta}
                      valor={l.texto}
                      extra={l.extra}
                      // Los primeros puntos abren el detalle hacia la derecha y los últimos hacia la izquierda.
                      className={`top-0 ${i < lugares.length / 2 ? "left-1/2 ml-3" : "right-1/2 mr-3"}`}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-1.5 flex" aria-hidden>
            {puntos.map((p, i) => (
              <span key={p.clave} className="min-w-0 flex-1 text-center text-[12px] font-semibold whitespace-nowrap text-tinta-2">
                {i % paso === 0 ? (p.etiquetaCorta ?? p.etiqueta) : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      {promedio > 0 && (
        <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-tinta-2">
          <span aria-hidden className="w-6 border-t-2 border-dashed border-tinta/45" />
          Promedio por {cada}: <span className="font-bold text-tinta tabular-nums">{formatoEje(promedio)}</span>
        </p>
      )}
    </figure>
  );
}
