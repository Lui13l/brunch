import { useState } from "react";

// Gráficas de los reportes: barras para comparar categorías y, para una serie
// en el tiempo, puntos unidos por una línea que se pueden comparar con otro periodo. Sin librerías: son pocos datos y así usan los
// mismos colores y la misma tipografía que el resto de la app.
//
// Reglas que siguen las dos:
//  - Lo que se mira va en un solo color (caramelo). Solo el periodo comparado
//    usa otro (`comparado`, validado para daltonismo junto al caramelo), y
//    además va punteado. El texto nunca lleva el color de la marca: los
//    valores van en tinta para que se lean bien.
//  - La barra es delgada, con la punta apenas redondeada y la base recta; los
//    puntos llevan un borde claro que los separa cuando quedan pegados.
//  - Cada marca responde al mouse, al dedo y al teclado con su detalle; al
//    señalar una, las demás se apagan para que el ojo no tenga que buscarla.
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
      {[].concat(extra ?? []).map((renglon) => (
        <span key={renglon} className="block text-[13px] text-white/75">
          {renglon}
        </span>
      ))}
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

// Con más puntos que estos, los marcadores grandes se pisan: se achican.
const MUCHOS_PUNTOS = 31;

// Muestra de un trazo para la leyenda.
function Muestra({ className }) {
  return <span aria-hidden className={`inline-block w-6 shrink-0 border-t-2 ${className}`} />;
}

/**
 * Una serie en el tiempo (ventas por día) para analizarla: un punto por día,
 * una línea que los une y, si se pide, otro periodo encima para compararlo.
 *
 * Sigue lo que hacen los tableros de análisis:
 *  - El periodo que se mira va en línea continua y con puntos; el periodo con
 *    el que se compara, en punteada, más delgada y de otro color, para que
 *    acompañe sin competir. Los dos se distinguen también sin ver el color.
 *  - La línea puede no pasar por los puntos: con una media móvil, los puntos
 *    siguen siendo lo vendido cada día y la línea muestra la tendencia.
 *  - Con dos trazos o más hay leyenda; el detalle de cada día sale al señalarlo.
 *
 * @param puntos [{ clave, etiqueta, etiquetaCorta?, valor, texto, extra?, marca? }]
 *   `extra` son los renglones del detalle (texto o lista de textos).
 *   `marca` (verdadero) dibuja un aro alrededor del punto: un festivo.
 * @param linea Valores por donde pasa la línea, uno por punto. Por defecto,
 *   los mismos de los puntos.
 * @param comparada Valores del otro periodo, uno por punto (null donde no hay).
 * @param leyenda { puntos, linea?, comparada?, marca? } Cómo se llama cada trazo.
 * @param rotular Qué punto lleva su valor escrito: "mayor" o "ultimo".
 * @param conPromedio Dibuja la línea punteada del promedio de los puntos.
 * @param formatoEje Cómo escribir los números del eje (compactos).
 * @param cada Qué representa cada punto ("día", "mes"), para rotular el promedio.
 */
export function SerieTiempo({
  puntos,
  linea,
  comparada = null,
  leyenda = {},
  rotular = "mayor",
  conPromedio = true,
  titulo,
  formatoEje,
  cada = "día",
}) {
  const [activa, setActiva] = useState(null);
  const valores = puntos.map((p) => p.valor);
  const trazoPrincipal = linea ?? valores;
  const maximo = Math.max(...valores, ...trazoPrincipal, ...(comparada ?? []).map((v) => v ?? 0), 0);
  const tope = topeRedondo(maximo);
  const marcas = [1, 0.75, 0.5, 0.25, 0];
  const promedio = puntos.length > 0 ? valores.reduce((suma, v) => suma + v, 0) / puntos.length : 0;
  const paso = pasoDeRotulos(puntos.length);
  // En el celular, con más de 20 puntos ya se pisan: ahí se achican antes.
  const tamano = puntos.length <= 20 ? "size-3" : puntos.length <= MUCHOS_PUNTOS ? "size-2 sm:size-3" : "size-2";
  const rotulado = rotular === "ultimo" ? puntos.at(-1)?.clave : puntos.find((p) => p.valor === Math.max(...valores))?.clave;

  // Cada punto va al centro de su franja: así coincide con su rótulo de abajo
  // y con la zona que responde al mouse. En porcentajes del área de la gráfica.
  const x = (i) => ((i + 0.5) / puntos.length) * 100;
  const y = (valor) => 100 - (valor / tope) * 100;
  // Un hueco (null) corta el trazo en vez de bajarlo a cero.
  const camino = (serie) => {
    let trazo = "";
    let seguido = false;
    serie.forEach((valor, i) => {
      if (valor == null) {
        seguido = false;
        return;
      }
      trazo += `${seguido ? "L" : "M"}${x(i)} ${y(valor)} `;
      seguido = true;
    });
    return trazo;
  };
  const lugares = puntos.map((p, i) => ({ ...p, i, x: x(i), y: y(p.valor) }));
  const senalado = lugares.find((l) => l.clave === activa);
  // La sombra bajo la línea solo cuando está sola: con otro periodo encima estorba.
  const conSombra = !comparada && !linea;
  const conMarcas = puntos.some((p) => p.marca);
  const conLeyenda = Boolean(comparada || leyenda.linea || conMarcas);

  return (
    <figure aria-label={titulo} className="m-0">
      {conLeyenda && (
        <ul className="mb-8 flex flex-wrap gap-x-5 gap-y-1 text-[13px] font-semibold text-tinta-2">
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-3 shrink-0 rounded-full bg-caramelo" />
            {leyenda.puntos}
          </li>
          {leyenda.linea && (
            <li className="flex items-center gap-2">
              <Muestra className="border-caramelo" />
              {leyenda.linea}
            </li>
          )}
          {comparada && (
            <li className="flex items-center gap-2">
              <Muestra className="border-dashed border-comparado" />
              {leyenda.comparada}
            </li>
          )}
          {conMarcas && (
            <li className="flex items-center gap-2">
              <span aria-hidden className="size-4 shrink-0 rounded-full border-2 border-tinta/55" />
              {leyenda.marca ?? "Día especial"}
            </li>
          )}
        </ul>
      )}

      <div className="flex gap-2">
        {/* Eje: cinco números redondos. */}
        <div
          className="flex h-56 flex-col justify-between text-right text-[12px] font-semibold text-tinta-2 tabular-nums"
          aria-hidden
        >
          {marcas.map((m) => (
            <span key={m} className="leading-none">
              {formatoEje(tope * m)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-56">
            {marcas.map((m) => (
              <span
                key={m}
                aria-hidden
                className={`absolute inset-x-0 border-t ${m === 0 ? "border-tinta-2/60" : "border-filete/70"}`}
                style={{ bottom: `${m * 100}%` }}
              />
            ))}

            {conPromedio && promedio > 0 && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 border-t-2 border-dotted border-tinta/40"
                style={{ bottom: `${(promedio / tope) * 100}%` }}
              />
            )}

            {/* Los trazos se estiran con el contenedor; su grosor no
                (vectorEffect), para que sigan midiendo lo mismo en píxeles. */}
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 size-full animate-[linea-entra_650ms_ease-out_both] overflow-visible"
            >
              {conSombra && (
                <path d={`${camino(trazoPrincipal)}L${x(puntos.length - 1)} 100 L${x(0)} 100 Z`} className="fill-caramelo/10" />
              )}
              {comparada && (
                <path
                  d={camino(comparada)}
                  fill="none"
                  className="stroke-comparado"
                  strokeWidth="1.75"
                  strokeDasharray="5 4"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <path
                d={camino(trazoPrincipal)}
                fill="none"
                className="stroke-caramelo"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Guía vertical del punto señalado: lo une con su día en el eje. */}
            {senalado && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-tinta/35"
                style={{ left: `${senalado.x}%` }}
              />
            )}

            {/* Dónde iba el otro periodo ese mismo día. */}
            {senalado && comparada?.[senalado.i] != null && (
              <span
                aria-hidden
                className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-mantel bg-comparado"
                style={{ left: `${senalado.x}%`, top: `${y(comparada[senalado.i])}%` }}
              />
            )}

            {/* Días especiales (festivos): un aro alrededor del punto. No es
                color: se distingue igual en blanco y negro. */}
            {lugares
              .filter((l) => l.marca)
              .map((l) => (
                <span
                  key={`marca-${l.clave}`}
                  aria-hidden
                  className={`pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-tinta/55 ${
                    activa !== null && l.clave !== activa ? "opacity-45" : ""
                  }`}
                  style={{ left: `${l.x}%`, top: `${l.y}%` }}
                />
              ))}

            {/* El borde claro separa cada punto de la línea y de sus vecinos. Al
                señalar uno, los demás se apagan para que el ojo no tenga que buscarlo. */}
            {lugares.map((l) => {
              const es = l.clave === activa;
              return (
                <span
                  key={l.clave}
                  aria-hidden
                  className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-[punto-entra_320ms_ease-out_both] rounded-full border-2 border-mantel transition-[width,height,background-color,opacity] duration-100 ${
                    es ? "z-[1] size-4 bg-rio" : `${tamano} bg-caramelo`
                  } ${activa !== null && !es ? "opacity-45" : ""}`}
                  style={{ left: `${l.x}%`, top: `${l.y}%`, animationDelay: `${Math.min(l.i, 40) * 18}ms` }}
                />
              );
            })}

            {activa === null && lugares.filter((l) => l.clave === rotulado).map((l) => (
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
              {lugares.map((l) => (
                <button
                  key={l.clave}
                  type="button"
                  data-sin-hover
                  aria-label={[`${l.etiqueta}: ${l.texto}`, ...[].concat(l.extra ?? [])].join(". ")}
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
                      className={`top-0 ${l.i < lugares.length / 2 ? "left-1/2 ml-3" : "right-1/2 mr-3"}`}
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

      {conPromedio && promedio > 0 && (
        <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-tinta-2">
          <Muestra className="border-dotted border-tinta/40" />
          Promedio por {cada}: <span className="font-bold text-tinta tabular-nums">{formatoEje(promedio)}</span>
        </p>
      )}
    </figure>
  );
}
