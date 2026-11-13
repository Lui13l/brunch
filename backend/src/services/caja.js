const { Arqueo, Comanda } = require("../models");
const { redondear2 } = require("../utils/dinero");
const { toArqueo } = require("../utils/serializar");
const { publicar, TOPICS } = require("../ws/hub");

const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"];
const SIN_METODO = "SIN_REGISTRAR";

const arqueoAbierto = (session) => Arqueo.findOne({ estado: "ABIERTO" }).session(session || null);

/**
 * Lo que la caja dice que debería haber, a partir de las comandas cobradas en
 * el intervalo del arqueo y de los movimientos no anulados.
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
    .select("total metodo_pago")
    .lean();

  const porMetodo = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0, [SIN_METODO]: 0 };
  for (const venta of ventas) {
    // Una venta sin método no se descarta: se agrupa aparte para que se vea.
    const clave = METODOS.includes(venta.metodo_pago) ? venta.metodo_pago : SIN_METODO;
    porMetodo[clave] += Number(venta.total ?? 0);
  }

  const vigentes = (arqueo.movimientos ?? []).filter((m) => !m.anulado);
  const suma = (tipo) => vigentes.filter((m) => m.tipo === tipo).reduce((s, m) => s + Number(m.monto), 0);
  const ingresos = suma("INGRESO");
  const egresos = suma("EGRESO");
  const base = Number(arqueo.base_inicial);

  // Solo el efectivo arrastra la base y los movimientos: tarjeta y transferencia
  // no pasan por el cajón.
  const calculado = {
    EFECTIVO: redondear2(base + porMetodo.EFECTIVO + ingresos - egresos),
    TARJETA: redondear2(porMetodo.TARJETA),
    TRANSFERENCIA: redondear2(porMetodo.TRANSFERENCIA),
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
    ingresos: redondear2(ingresos),
    egresos: redondear2(egresos),
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
