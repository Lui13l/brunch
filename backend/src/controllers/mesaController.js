const { z } = require("zod");
const { Mesa, Comanda } = require("../models");
const { HttpError } = require("../utils/http");
const { textoOpcional } = require("../utils/validar");
const { toMesa } = require("../utils/serializar");
const { registrar, SERVICIO } = require("../services/auditoria");

const mesaSchema = z.object({
  numero: z.coerce
    .number({ error: "El número de mesa es obligatorio" })
    .int("El número de mesa debe ser entero")
    .min(1, "El número de mesa empieza en 1")
    .max(999, "Número de mesa demasiado alto"),
  nombre: textoOpcional("El nombre", 60),
  capacidad: z.coerce
    .number({ error: "La capacidad debe ser un número" })
    .int("La capacidad debe ser entera")
    .min(1, "La capacidad mínima es 1")
    .max(100, "Capacidad demasiado alta para una sola mesa")
    .nullish()
    .transform((v) => v ?? 4),
  activa: z.boolean({ error: "'activa' debe ser verdadero o falso" }).default(true),
});

// mesa_id -> id de su comanda abierta
const comandasAbiertas = async () => {
  const abiertas = await Comanda.find({ estado: "ABIERTA" }).select("mesa_id").lean();
  return new Map(abiertas.map((c) => [String(c.mesa_id), c._id]));
};

const serializarTodas = async (mesas) => {
  const abiertas = await comandasAbiertas();
  return mesas.map((m) => toMesa(m, abiertas.get(String(m._id))));
};

const buscarMesa = async (id) => {
  const mesa = await Mesa.findById(id);
  if (!mesa) throw new HttpError(404, "Mesa no encontrada");
  return mesa;
};

const duplicada = (err, numero) =>
  err.code === 11000 ? new HttpError(409, `Ya existe la mesa ${numero}`) : err;

// Salón: solo mesas activas.
const listar = async (req, res) => {
  res.json(await serializarTodas(await Mesa.find({ activa: true }).sort({ numero: 1 }).lean()));
};

const listarTodas = async (req, res) => {
  res.json(await serializarTodas(await Mesa.find().sort({ numero: 1 }).lean()));
};

const crear = async (req, res) => {
  const datos = req.valid.body;
  let mesa;
  try {
    mesa = await Mesa.create(datos);
  } catch (err) {
    throw duplicada(err, datos.numero);
  }
  await registrar(req.usuario, "CREAR_MESA", `Creó la mesa ${mesa.numero}`, SERVICIO.COMANDAS);
  res.json(toMesa(mesa));
};

const editar = async (req, res) => {
  const datos = req.valid.body;
  const previa = await buscarMesa(req.valid.params.id);
  const abierta = await Comanda.exists({ mesa_id: previa._id, estado: "ABIERTA" });
  if (!datos.activa && abierta) {
    throw new HttpError(409, `La mesa ${previa.numero} tiene una cuenta abierta: ciérrala antes de desactivarla`);
  }

  Object.assign(previa, datos);
  try {
    await previa.save();
  } catch (err) {
    throw duplicada(err, datos.numero);
  }
  await registrar(req.usuario, "EDITAR_MESA", `Editó la mesa ${previa.numero}`, SERVICIO.COMANDAS);
  res.json(toMesa(previa, abierta?._id));
};

const eliminar = async (req, res) => {
  const mesa = await buscarMesa(req.valid.params.id);
  const comandas = await Comanda.countDocuments({ mesa_id: mesa._id });
  if (comandas > 0) {
    throw new HttpError(
      409,
      `La mesa ${mesa.numero} ya tiene ${comandas} comanda(s) registradas. Desactívala en vez de borrarla.`
    );
  }
  await mesa.deleteOne();
  await registrar(req.usuario, "ELIMINAR_MESA", `Eliminó la mesa ${mesa.numero}`, SERVICIO.COMANDAS);
  res.status(204).end();
};

module.exports = { mesaSchema, listar, listarTodas, crear, editar, eliminar };
