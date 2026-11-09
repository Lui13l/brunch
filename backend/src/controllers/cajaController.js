const { z } = require("zod");
const { Arqueo } = require("../models");
const { HttpError } = require("../utils/http");
const { texto, textoOpcional, dinero } = require("../utils/validar");
const { pesos, redondear2 } = require("../utils/dinero");
const { registrar, SERVICIO } = require("../services/auditoria");
const { codigoCorto } = require("../utils/codigo");
const { calcularCuadre, conUsuarios, estadoDe, estadoActual, publicarCaja } = require("../services/caja");

const abrirSchema = z.object({ baseInicial: dinero("La base inicial"), notas: textoOpcional("Las notas") });

const movimientoSchema = z.object({
  tipo: z.enum(["INGRESO", "EGRESO"], { error: "El tipo debe ser INGRESO o EGRESO" }),
  // Un movimiento sin explicar es justo lo que después nadie sabe justificar.
  concepto: texto("El concepto"),
  monto: dinero("El monto", { minimo: 0.01 }),
});

const cerrarSchema = z.object({
  contadoEfectivo: dinero("El efectivo contado"),
  contadoTarjeta: dinero("El total de tarjeta"),
  contadoTransferencia: dinero("El total de transferencias"),
  notas: textoOpcional("Las notas"),
});

const SIN_CAJA = "No hay ninguna caja abierta. Ábrela antes de registrar movimientos.";

const enviar = async (res, arqueoId) => {
  const arqueo = await conUsuarios(Arqueo.findById(arqueoId)).lean();
  res.json(await estadoDe(arqueo));
  publicarCaja();
};

const actual = async (req, res) => res.json(await estadoActual());

const abrir = async (req, res) => {
  const { baseInicial, notas } = req.valid.body;
  let arqueo;
  try {
    arqueo = await Arqueo.create({ base_inicial: baseInicial, abierto_por: req.usuario._id, notas_apertura: notas });
  } catch (err) {
    // Lo impide un índice único parcial: si dos personas abren a la vez, una llega aquí.
    if (err.code === 11000) throw new HttpError(409, "Ya hay una caja abierta");
    throw err;
  }
  await registrar(req.usuario, "ABRIR_CAJA", `Abrió la caja con ${pesos(baseInicial)} de base`, SERVICIO.CAJA);
  await enviar(res, arqueo._id);
};

const cerrar = async (req, res) => {
  const { contadoEfectivo, contadoTarjeta, contadoTransferencia, notas } = req.valid.body;
  const abierta = await Arqueo.findOne({ estado: "ABIERTO" }).lean();
  if (!abierta) throw new HttpError(409, SIN_CAJA);

  // Lo esperado se congela con el mismo instante que queda como cierre.
  const ahora = new Date();
  const cuadre = await calcularCuadre(abierta, ahora);
  const cerrado = await Arqueo.findOneAndUpdate(
    { _id: abierta._id, estado: "ABIERTO" },
    {
      $set: {
        estado: "CERRADO",
        cerrado_por: req.usuario._id,
        esperado_efectivo: cuadre.esperado.EFECTIVO,
        esperado_tarjeta: cuadre.esperado.TARJETA,
        esperado_transferencia: cuadre.esperado.TRANSFERENCIA,
        contado_efectivo: contadoEfectivo,
        contado_tarjeta: contadoTarjeta,
        contado_transferencia: contadoTransferencia,
        notas_cierre: notas,
        fecha_cierre: ahora,
      },
    },
    { returnDocument: "after" }
  );
  if (!cerrado) throw new HttpError(409, SIN_CAJA);

  const diferencia = redondear2(contadoEfectivo - cuadre.esperado.EFECTIVO);
  const resumen =
    diferencia === 0
      ? "cuadrada"
      : diferencia > 0
        ? `con ${pesos(diferencia)} de sobrante`
        : `con ${pesos(Math.abs(diferencia))} de faltante`;
  await registrar(
    req.usuario,
    "CERRAR_CAJA",
    `Cerró la caja ${codigoCorto(cerrado._id)} ${resumen} (contado ${pesos(contadoEfectivo)}, esperado ${pesos(cuadre.esperado.EFECTIVO)})`,
    SERVICIO.CAJA
  );
  await enviar(res, cerrado._id);
};

const registrarMovimiento = async (req, res) => {
  const { tipo, concepto, monto } = req.valid.body;
  const arqueo = await Arqueo.findOneAndUpdate(
    { estado: "ABIERTO" },
    { $push: { movimientos: { tipo, concepto, monto, usuario_id: req.usuario._id } } },
    { returnDocument: "after", runValidators: true }
  );
  if (!arqueo) throw new HttpError(409, SIN_CAJA);

  await registrar(
    req.usuario,
    tipo === "INGRESO" ? "INGRESO_CAJA" : "EGRESO_CAJA",
    `${tipo === "INGRESO" ? "Entrada" : "Salida"} de ${pesos(monto)} en caja: ${concepto}`,
    SERVICIO.CAJA
  );
  await enviar(res, arqueo._id);
};

// Los movimientos no se borran: se anulan, y solo mientras su caja está abierta.
const anularMovimiento = async (req, res) => {
  const movId = req.valid.params.id;
  const abierta = await Arqueo.findOne({ estado: "ABIERTO" }).lean();
  if (!abierta) throw new HttpError(409, SIN_CAJA);

  const movimiento = abierta.movimientos.find((m) => String(m._id) === movId);
  if (!movimiento) throw new HttpError(404, "Movimiento no encontrado en la caja abierta");
  if (movimiento.anulado) throw new HttpError(409, "Ese movimiento ya estaba anulado");

  const r = await Arqueo.updateOne(
    { _id: abierta._id, estado: "ABIERTO", movimientos: { $elemMatch: { _id: movId, anulado: false } } },
    { $set: { "movimientos.$.anulado": true } }
  );
  if (r.modifiedCount === 0) throw new HttpError(409, "Ese movimiento ya estaba anulado");

  await registrar(
    req.usuario,
    "ANULAR_MOVIMIENTO_CAJA",
    `Anuló ${movimiento.tipo === "INGRESO" ? "la entrada" : "la salida"} de ${pesos(movimiento.monto)}: ${movimiento.concepto}`,
    SERVICIO.CAJA
  );
  await enviar(res, abierta._id);
};

const historial = async (req, res) => {
  const arqueos = await conUsuarios(Arqueo.find({ estado: "CERRADO" }).sort({ fecha_apertura: -1 }).limit(60)).lean();
  res.json(await Promise.all(arqueos.map(async (a) => {
    const { arqueo, cuadre } = await estadoDe(a);
    return { arqueo, cuadre };
  })));
};

const detalle = async (req, res) => {
  const arqueo = await conUsuarios(Arqueo.findById(req.valid.params.id)).lean();
  if (!arqueo) throw new HttpError(404, "Arqueo no encontrado");
  res.json(await estadoDe(arqueo));
};

module.exports = {
  abrirSchema,
  movimientoSchema,
  cerrarSchema,
  actual,
  abrir,
  cerrar,
  registrarMovimiento,
  anularMovimiento,
  historial,
  detalle,
};
