import { Banknote, CreditCard, Smartphone } from "lucide-react";

// Reparto de una cuenta entre varias personas. Aquí solo se arma la propuesta:
// el servidor vuelve a sumar los pagos y rechaza el cobro si no dan el total.

export const METODOS_PAGO = [
  { valor: "EFECTIVO", texto: "Efectivo", Icono: Banknote },
  { valor: "TARJETA", texto: "Tarjeta", Icono: CreditCard },
  { valor: "TRANSFERENCIA", texto: "Transferencia", Icono: Smartphone },
];

// Por platos se reparte tocando un número por persona: con más de 8 los
// botones ya no caben en una fila del celular.
export const MAX_PERSONAS = 8;
// Tope de pagos que acepta el servidor por cuenta.
export const MAX_PARTES = 20;

export const DIVISION_INICIAL = { forma: "iguales", partes: 2, metodos: [], asignacion: {} };

const redondear2 = (valor) => Math.round(valor * 100) / 100;

// Una fila por unidad: "3 cafés" son tres unidades que pueden pagar personas distintas.
export const unidadesDe = (items) =>
  items.flatMap((item) =>
    Array.from({ length: item.cantidad }, (_, n) => ({
      clave: `${item.id}:${n}`,
      nombre: item.nombre,
      precio: item.precioUnitario,
    })),
  );

// Partes iguales en pesos enteros; lo que no divide exacto se lo lleva la última.
const partesIguales = (total, n) => {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i < n - 1 ? base : redondear2(total - base * (n - 1))));
};

/**
 * Las partes de la cuenta según cómo se esté dividiendo.
 * - `partes`: una por persona, con su monto y el método que ya eligió.
 * - `sinRepartir`: unidades que nadie tiene todavía (solo por platos).
 * - `pagos`: lo que se envía al servidor, o null si todavía falta algo.
 */
export function repartir(division, unidades, total) {
  const n = division.partes;
  let montos;
  let sinRepartir = 0;

  if (division.forma === "iguales") {
    montos = partesIguales(total, n);
  } else {
    montos = Array.from({ length: n }, () => 0);
    for (const unidad of unidades) {
      const persona = division.asignacion[unidad.clave];
      // Si se quitó una persona, sus platos vuelven a quedar sin repartir.
      if (persona == null || persona >= n) sinRepartir += 1;
      else montos[persona] += unidad.precio;
    }
  }

  const partes = montos.map((monto, i) => ({
    indice: i,
    etiqueta: division.forma === "iguales" ? `Parte ${i + 1} de ${n}` : `Persona ${i + 1}`,
    monto: redondear2(monto),
    metodo: division.metodos[i] ?? null,
  }));

  // Quien no tiene platos no paga: no cuenta como parte ni necesita método.
  const conMonto = partes.filter((p) => p.monto > 0);
  const sinMetodo = conMonto.filter((p) => !p.metodo).length;
  const completa = sinRepartir === 0 && sinMetodo === 0 && conMonto.length > 0;

  return {
    partes,
    sinRepartir,
    sinMetodo,
    pagos: completa ? conMonto.map(({ metodo, monto, etiqueta }) => ({ metodo, monto, etiqueta })) : null,
  };
}
