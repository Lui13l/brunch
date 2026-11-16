// Geometría del plano del salón: una cuadrícula cuadrada donde cada mesa ocupa
// unas celdas según su forma y su capacidad. La app del personal dibuja con la
// misma regla (personal/src/lib/plano.js): si cambia una, cambia la otra.

const LADO = 12;
const FORMAS = ["cuadrada", "redonda", "rectangular"];

// Celdas que ocupa una mesa. Las rectangulares crecen a lo largo; girada 90°
// el largo pasa a ser el alto.
const huella = ({ forma = "cuadrada", capacidad = 4, rotacion = 0 }) => {
  if (forma === "rectangular") {
    const largo = capacidad <= 6 ? 3 : capacidad <= 10 ? 4 : 5;
    return rotacion === 90 ? { ancho: 2, alto: largo } : { ancho: largo, alto: 2 };
  }
  const lado = capacidad <= (forma === "redonda" ? 6 : 4) ? 2 : 3;
  return { ancho: lado, alto: lado };
};

// Rectángulo que ocupa una mesa ya ubicada (pos_x y pos_y no nulos).
const caja = (mesa) => ({ x: mesa.pos_x, y: mesa.pos_y, ...huella(mesa) });

const dentro = (c) => c.x >= 0 && c.y >= 0 && c.x + c.ancho <= LADO && c.y + c.alto <= LADO;

const seCruzan = (a, b) => a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;

const ubicada = (mesa) => mesa.pos_x != null && mesa.pos_y != null;

// ¿La mesa cabe donde está, sin salirse ni encimarse con las otras?
const cabe = (mesa, otras) => {
  const propia = caja(mesa);
  return dentro(propia) && !otras.filter(ubicada).some((otra) => seCruzan(propia, caja(otra)));
};

module.exports = { LADO, FORMAS, huella, caja, dentro, seCruzan, ubicada, cabe };
