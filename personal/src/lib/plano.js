// Geometría del plano del salón: una cuadrícula cuadrada donde cada mesa ocupa
// unas celdas según su forma y su capacidad. El servidor valida con la misma
// regla (backend/src/utils/plano.js): si cambia una, cambia la otra.

export const LADO = 12;

export const FORMAS = [
  { valor: "cuadrada", texto: "Cuadrada" },
  { valor: "redonda", texto: "Redonda" },
  { valor: "rectangular", texto: "Rectangular" },
];

// Celdas que ocupa una mesa. Las rectangulares crecen a lo largo; girada 90°
// el largo pasa a ser el alto.
export const huella = ({ forma = "cuadrada", capacidad = 4, rotacion = 0 }) => {
  if (forma === "rectangular") {
    const largo = capacidad <= 6 ? 3 : capacidad <= 10 ? 4 : 5;
    return rotacion === 90 ? { ancho: 2, alto: largo } : { ancho: largo, alto: 2 };
  }
  const lado = capacidad <= (forma === "redonda" ? 6 : 4) ? 2 : 3;
  return { ancho: lado, alto: lado };
};

export const ubicada = (mesa) => mesa.x != null && mesa.y != null;

const caja = (mesa) => ({ x: mesa.x, y: mesa.y, ...huella(mesa) });
const dentro = (c) => c.x >= 0 && c.y >= 0 && c.x + c.ancho <= LADO && c.y + c.alto <= LADO;
const seCruzan = (a, b) => a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;

// ¿La mesa cabe donde está, sin salirse ni encimarse con las otras?
export const cabe = (mesa, otras) => {
  const propia = caja(mesa);
  return dentro(propia) && !otras.filter(ubicada).some((otra) => seCruzan(propia, caja(otra)));
};

// El primer lugar libre, leyendo el plano como un texto: de izquierda a
// derecha y de arriba abajo. null si no queda espacio.
export const primerHueco = (mesa, otras) => {
  for (let y = 0; y < LADO; y += 1) {
    for (let x = 0; x < LADO; x += 1) {
      if (cabe({ ...mesa, x, y }, otras)) return { x, y };
    }
  }
  return null;
};
