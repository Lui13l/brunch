import { huella } from "../lib/plano";

// Dibujo de una mesa vista desde arriba, con una silla por puesto. Se dibuja
// con código y no con imágenes: así sirve para cualquier capacidad y forma, y
// toma el color del texto de la pieza donde va (crema, espresso o verde).

const CELDA = 44; // tamaño de una celda del plano dentro del dibujo
const MARGEN = 17; // espacio alrededor del tablero, donde van las sillas
const SILLA = 17; // ancho que necesita una silla sobre un lado
const SEPARACION = 8; // del borde del tablero al centro de la silla

// Reparte las sillas entre los cuatro lados según su largo: cada silla va al
// lado que queda menos lleno. Con eso una mesa cuadrada de 4 recibe una por
// lado y una larga de 10 queda 4 + 4 y una en cada cabecera.
const repartir = (sillas, largoHorizontal, largoVertical) => {
  const lados = [
    { lado: "arriba", largo: largoHorizontal, cuantas: 0 },
    { lado: "abajo", largo: largoHorizontal, cuantas: 0 },
    { lado: "derecha", largo: largoVertical, cuantas: 0 },
    { lado: "izquierda", largo: largoVertical, cuantas: 0 },
  ];
  for (let i = 0; i < sillas; i += 1) {
    const libres = lados.filter((l) => l.cuantas < Math.floor(l.largo / SILLA));
    if (libres.length === 0) break; // no caben más: el número de la mesa ya dice la capacidad
    libres.reduce((mejor, l) => ((l.cuantas + 1) / l.largo < (mejor.cuantas + 1) / mejor.largo ? l : mejor)).cuantas += 1;
  }
  return lados;
};

// Asiento con el espaldar hacia afuera. `giro` lo orienta hacia la mesa.
function Silla({ x, y, giro }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${giro})`}>
      <rect x={-7} y={-4} width={14} height={11} rx={3} />
      <path d="M -6 -7 h 12" strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

const sillasAlrededor = (capacidad, ancho, alto) => {
  const largoH = ancho - MARGEN * 2;
  const largoV = alto - MARGEN * 2;
  return repartir(capacidad, largoH, largoV).flatMap(({ lado, cuantas }) =>
    Array.from({ length: cuantas }, (_, i) => {
      const paso = (i + 0.5) / cuantas;
      if (lado === "arriba") return { x: MARGEN + largoH * paso, y: MARGEN - SEPARACION, giro: 0 };
      if (lado === "abajo") return { x: MARGEN + largoH * paso, y: alto - MARGEN + SEPARACION, giro: 180 };
      if (lado === "derecha") return { x: ancho - MARGEN + SEPARACION, y: MARGEN + largoV * paso, giro: 90 };
      return { x: MARGEN - SEPARACION, y: MARGEN + largoV * paso, giro: 270 };
    }),
  );
};

const sillasEnRonda = (capacidad, centro, radio) => {
  const cuantas = Math.min(capacidad, Math.floor((2 * Math.PI * (radio + SEPARACION)) / SILLA));
  return Array.from({ length: cuantas }, (_, i) => {
    const angulo = (360 / cuantas) * i;
    const rad = (angulo * Math.PI) / 180;
    return {
      x: centro.x + (radio + SEPARACION) * Math.sin(rad),
      y: centro.y - (radio + SEPARACION) * Math.cos(rad),
      giro: angulo,
    };
  });
};

/**
 * @param capacidad Puestos de la mesa: una silla por cada uno.
 * @param forma "cuadrada" | "redonda" | "rectangular"
 * @param rotacion 0 o 90; solo cambia el dibujo de las rectangulares.
 */
export default function MesaIlustracion({ capacidad = 4, forma = "cuadrada", rotacion = 0, className = "" }) {
  const celdas = huella({ forma, capacidad, rotacion });
  const ancho = celdas.ancho * CELDA;
  const alto = celdas.alto * CELDA;
  const redonda = forma === "redonda";
  const centro = { x: ancho / 2, y: alto / 2 };
  const radio = Math.min(ancho, alto) / 2 - MARGEN;
  const sillas = redonda ? sillasEnRonda(capacidad, centro, radio) : sillasAlrededor(capacidad, ancho, alto);

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      aria-hidden
    >
      {sillas.map((silla) => (
        <Silla key={`${silla.x}-${silla.y}`} {...silla} />
      ))}
      {redonda ? (
        <circle cx={centro.x} cy={centro.y} r={radio} fill="currentColor" fillOpacity={0.08} />
      ) : (
        <rect
          x={MARGEN}
          y={MARGEN}
          width={ancho - MARGEN * 2}
          height={alto - MARGEN * 2}
          rx={5}
          fill="currentColor"
          fillOpacity={0.08}
        />
      )}
    </svg>
  );
}
