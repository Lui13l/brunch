// Redondeo decimal sin arrastrar errores de coma flotante (0.1 + 0.2).
const redondear = (valor, decimales) => {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  return Number(`${Math.round(Number(`${n}e${decimales}`))}e-${decimales}`);
};

const redondear2 = (valor) => redondear(valor, 2);
const redondear3 = (valor) => redondear(valor, 3);
const pesos = (n) => `$${Number(n).toLocaleString("es-CO")}`;

module.exports = { redondear2, redondear3, pesos };
