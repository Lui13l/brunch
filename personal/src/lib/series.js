// Cuentas para analizar las ventas día a día: con qué periodo compararlas y
// cómo leerlas (acumulado, media móvil, variación). Las fechas son textos
// AAAA-MM-DD, que se ordenan y comparan como texto; se pasan por UTC solo para
// sumar días sin que un cambio de hora mueva la fecha.

const aFecha = (iso) => new Date(`${iso}T00:00:00Z`);
const aISO = (fecha) => fecha.toISOString().slice(0, 10);

export const sumarDias = (iso, dias) => {
  const fecha = aFecha(iso);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aISO(fecha);
};

// Todos los días del rango, incluidos los dos extremos.
export const diasEntre = (desde, hasta) => {
  const dias = [];
  for (let dia = desde; dia <= hasta; dia = sumarDias(dia, 1)) dias.push(dia);
  return dias;
};

// El mismo día del mes en otro mes. Si ese mes es más corto, el último que
// tenga (31 de marzo -> 28 de febrero).
const enMes = (iso, anio, mes) => {
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return aISO(new Date(Date.UTC(anio, mes, Math.min(Number(iso.slice(8, 10)), ultimo))));
};

/**
 * El periodo con el que se compara, del mismo largo que el que se está viendo
 * para que cada día tenga su pareja.
 *
 * @param cual "anterior" (los días justo antes), "mes" (las mismas fechas del
 *   mes pasado) o un mes concreto "AAAA-MM".
 */
export const rangoComparado = (cual, desde, hasta) => {
  const largo = diasEntre(desde, hasta).length;
  let inicio;
  if (cual === "anterior") {
    inicio = sumarDias(desde, -largo);
  } else if (cual === "mes") {
    const fecha = aFecha(desde);
    inicio = enMes(desde, fecha.getUTCFullYear(), fecha.getUTCMonth() - 1);
  } else {
    inicio = enMes(desde, Number(cual.slice(0, 4)), Number(cual.slice(5, 7)) - 1);
  }
  return { desde: inicio, hasta: sumarDias(inicio, largo - 1) };
};

// Los meses anteriores al del periodo, del más reciente al más antiguo ("AAAA-MM").
export const mesesAnteriores = (desde, cuantos = 12) => {
  const fecha = aFecha(desde);
  return Array.from({ length: cuantos }, (_, i) =>
    aISO(new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() - (i + 1), 1))).slice(0, 7),
  );
};

// Lo vendido hasta cada día: dice si el periodo va por delante o por detrás
// del otro, aunque los días sueltos suban y bajen.
export const acumular = (valores) => {
  let suma = 0;
  return valores.map((valor) => (suma += valor));
};

// Promedio de cada día con los anteriores (hasta completar la ventana). Quita
// el sube y baja de un día a otro y deja ver hacia dónde va la venta. Los
// primeros días promedian los que haya.
export const mediaMovil = (valores, ventana = 7) =>
  valores.map((_, i) => {
    const tramo = valores.slice(Math.max(0, i - ventana + 1), i + 1);
    return tramo.reduce((suma, valor) => suma + valor, 0) / tramo.length;
  });

// Cuánto cambió respecto a la base, como proporción (0.12 = 12 % más). null
// si la base es 0: no hay contra qué medir.
export const variacion = (actual, base) => (base > 0 ? (actual - base) / base : null);

// "+12,5 %", "−8 %"
export const textoVariacion = (cambio) =>
  cambio == null
    ? "sin ventas para comparar"
    : `${cambio >= 0 ? "+" : "−"}${Math.abs(cambio * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
