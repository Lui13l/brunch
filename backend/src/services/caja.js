const { Arqueo, Comanda, Payment, Order } = require("../models");
const { redondear2 } = require("../utils/dinero");
const { pagosDeComanda } = require("../utils/pagos");
const { toArqueo } = require("../utils/serializar");
const { publicar, TOPICS } = require("../ws/hub");

const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"];
const SIN_METODO = "SIN_REGISTRAR";

const arqueoAbierto = (session) => Arqueo.findOne({ estado: "ABIERTO" }).session(session || null);

/**
 * Lo que entró por pedidos web mientras el arqueo estuvo abierto, por método.
 *
 * Un pedido web cuenta desde que se aprueba su pago (no al entregarse) y deja
 * de contar si se cancela. Los pagos aprobados antes de que existiera
 * `aprobado_en` usan la fecha de su último cambio.
 */
const ventasDePedidosWeb = async (desde, hasta) => {
  const enIntervalo = { $gte: desde, $lte: hasta };
  const pagos = await Payment.find({
    estado: "aprobado",
    $or: [{ aprobado_en: enIntervalo }, { aprobado_en: null, updatedAt: enIntervalo }],
  })
    .select("monto metodo pedido_id")
    .lean();

  const cancelados = new Set(
    (
      await Order.find({ _id: { $in: pagos.map((p) => p.pedido_id) }, estado: "cancelado" })
        .select("_id")
        .lean()
    ).map((p) => String(p._id))
  );

  const ventasWeb = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0 };
  let pedidosWeb = 0;
  for (const pago of pagos) {
    if (cancelados.has(String(pago.pedido_id))) continue;
    // Los pagos web guardan el método en minúscula.
    ventasWeb[String(pago.metodo).toUpperCase()] += Number(pago.monto);
    pedidosWeb += 1;
  }
  for (const m of METODOS) ventasWeb[m] = redondear2(ventasWeb[m]);
  return { ventasWeb, pedidosWeb };
};

/**
 * Lo que la caja dice que debería haber, a partir de las comandas cobradas en
 * el intervalo del arqueo, de los pedidos web con pago aprobado y de los
 * movimientos no anulados.
 *
 * Abierta: se calcula al vuelo. Cerrada: manda lo congelado al cerrar, y
 * "recalculado" muestra lo que dirían hoy las comandas por si alguien las tocó.
 */
const calcularCuadre = async (arqueo, hastaFijo) => {
  const hasta = arqueo.fecha_cierre ?? hastaFijo ?? new Date();
  const ventas = await Comanda.find({
    estado: "CERRADA",
    fecha_cierre: { $gte: arqueo.fecha_apertura, $lte: hasta },
  })
    .select("total metodo_pago pagos")
    .lean();

  const porMetodo = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0, [SIN_METODO]: 0 };
  for (const venta of ventas) {
    // Una cuenta dividida reparte su total entre los métodos de cada parte.
    for (const pago of pagosDeComanda(venta)) {
      // Una venta sin método no se descarta: se agrupa aparte para que se vea.
      const clave = METODOS.includes(pago.metodo) ? pago.metodo : SIN_METODO;
      porMetodo[clave] += pago.monto;
    }
  }

  const { ventasWeb, pedidosWeb } = await ventasDePedidosWeb(arqueo.fecha_apertura, hasta);

  // Entradas y salidas manuales, por método. Un movimiento sin método es de
  // efectivo (así eran todos antes de que existiera el campo).
  const movimientos = Object.fromEntries(METODOS.map((m) => [m, { ingresos: 0, egresos: 0 }]));
  for (const mov of arqueo.movimientos ?? []) {
    if (mov.anulado) continue;
    const metodo = METODOS.includes(mov.metodo) ? mov.metodo : "EFECTIVO";
    movimientos[metodo][mov.tipo === "INGRESO" ? "ingresos" : "egresos"] += Number(mov.monto);
  }
  for (const m of METODOS) {
    movimientos[m] = { ingresos: redondear2(movimientos[m].ingresos), egresos: redondear2(movimientos[m].egresos) };
  }
  const neto = (m) => movimientos[m].ingresos - movimientos[m].egresos;
  const ingresos = METODOS.reduce((s, m) => s + movimientos[m].ingresos, 0);
  const egresos = METODOS.reduce((s, m) => s + movimientos[m].egresos, 0);
  const base = Number(arqueo.base_inicial);

  // Solo el efectivo arrastra la base: es lo único que hay físicamente en el
  // cajón. Tarjeta y transferencia suman sus ventas y sus propios movimientos.
  // Las ventas son las de las mesas más las de los pedidos web.
  const calculado = {
    EFECTIVO: redondear2(base + porMetodo.EFECTIVO + ventasWeb.EFECTIVO + neto("EFECTIVO")),
    TARJETA: redondear2(porMetodo.TARJETA + ventasWeb.TARJETA + neto("TARJETA")),
    TRANSFERENCIA: redondear2(porMetodo.TRANSFERENCIA + ventasWeb.TRANSFERENCIA + neto("TRANSFERENCIA")),
  };

  const congelado = arqueo.estado === "CERRADO" && arqueo.esperado_efectivo != null;
  const esperado = congelado
    ? {
        EFECTIVO: Number(arqueo.esperado_efectivo),
        TARJETA: Number(arqueo.esperado_tarjeta ?? 0),
        TRANSFERENCIA: Number(arqueo.esperado_transferencia ?? 0),
      }
    : calculado;
  const contado = congelado
    ? {
        EFECTIVO: Number(arqueo.contado_efectivo ?? 0),
        TARJETA: Number(arqueo.contado_tarjeta ?? 0),
        TRANSFERENCIA: Number(arqueo.contado_transferencia ?? 0),
      }
    : null;

  return {
    baseInicial: redondear2(base),
    ventas: {
      EFECTIVO: redondear2(porMetodo.EFECTIVO),
      TARJETA: redondear2(porMetodo.TARJETA),
      TRANSFERENCIA: redondear2(porMetodo.TRANSFERENCIA),
      SIN_REGISTRAR: redondear2(porMetodo[SIN_METODO]),
    },
    comandas: ventas.length,
    // Pedidos web con pago aprobado; van aparte de `ventas`, que son las mesas.
    ventasWeb,
    pedidosWeb,
    // Totales de todos los métodos; el detalle por método va en `movimientos`.
    ingresos: redondear2(ingresos),
    egresos: redondear2(egresos),
    movimientos,
    esperado,
    contado,
    // Positiva = sobra dinero; negativa = falta.
    diferencia: contado
      ? {
          EFECTIVO: redondear2(contado.EFECTIVO - esperado.EFECTIVO),
          TARJETA: redondear2(contado.TARJETA - esperado.TARJETA),
          TRANSFERENCIA: redondear2(contado.TRANSFERENCIA - esperado.TRANSFERENCIA),
        }
      : null,
    recalculado: congelado ? calculado : null,
  };
};

const conUsuarios = (query) => query.populate("abierto_por", "nombre").populate("cerrado_por", "nombre");

// { abierta, arqueo, cuadre }: la forma de todas las respuestas de caja.
const estadoDe = async (arqueo) => ({
  abierta: arqueo.estado === "ABIERTO",
  arqueo: toArqueo(arqueo),
  cuadre: await calcularCuadre(arqueo),
});

const estadoActual = async () => {
  const arqueo = await conUsuarios(arqueoAbierto()).lean();
  if (!arqueo) return { abierta: false, arqueo: null, cuadre: null };
  return estadoDe(arqueo);
};

// Avisa a las pantallas de caja. Se llama también al cobrar una comanda.
// Nunca lanza: no debe romper la petición que lo provocó.
const publicarCaja = async () => {
  try {
    publicar(TOPICS.adminCaja, await estadoActual());
  } catch (error) {
    console.error("No se pudo publicar el estado de caja:", error.message);
  }
};

module.exports = { arqueoAbierto, calcularCuadre, conUsuarios, estadoDe, estadoActual, publicarCaja };
