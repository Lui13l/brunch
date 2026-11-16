const { redondear2 } = require("./dinero");

// Cómo se pagó una comanda cerrada, como lista de { metodo, monto }.
//
// Manda el `total` de la comanda, que es lo que el arqueo vigila: si alguien lo
// cambia después de cobrar, la diferencia tiene que verse.
// - Sin `pagos` (cuentas anteriores a la división) o con uno solo: un pago por
//   el total, con el método que tenga (puede faltar).
// - Dividida: cada parte con su método. Si las partes ya no suman el total, lo
//   que sobra o falta sale sin método, para que aparezca como "sin registrar".
const pagosDeComanda = (comanda) => {
  const total = Number(comanda.total ?? 0);
  const pagos = comanda.pagos ?? [];
  if (pagos.length <= 1) return [{ metodo: pagos[0]?.metodo ?? comanda.metodo_pago ?? null, monto: total }];

  const partes = pagos.map((p) => ({ metodo: p.metodo, monto: Number(p.monto ?? 0) }));
  const descuadre = redondear2(total - partes.reduce((suma, p) => suma + p.monto, 0));
  if (descuadre !== 0) partes.push({ metodo: null, monto: descuadre });
  return partes;
};

module.exports = { pagosDeComanda };
