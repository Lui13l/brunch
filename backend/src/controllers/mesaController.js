const { z } = require("zod");
const { Mesa, Comanda } = require("../models");
const { HttpError } = require("../utils/http");
const { textoOpcional } = require("../utils/validar");
const { toMesa } = require("../utils/serializar");
const { registrar, SERVICIO } = require("../services/auditoria");
const { publicar, TOPICS } = require("../ws/hub");

// El salón y la cocina vuelven a pedir las mesas cuando se crea, edita o borra una.
const avisarMesas = () => publicar(TOPICS.salon, { tipo: "mesas" });

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

// id de mesa -> { comandaId, grupo, principal } de su cuenta abierta. Una
// cuenta puede ocupar varias mesas (la principal y las que se le juntaron).
const comandasAbiertas = async () => {
  const abiertas = await Comanda.find({ estado: "ABIERTA" })
    .select("mesa_id mesas_extra")
    .populate("mesa_id", "numero")
    .populate("mesas_extra", "numero")
    .lean();
  const porMesa = new Map();
  for (const c of abiertas) {
    const mesas = [c.mesa_id, ...(c.mesas_extra ?? [])].filter(Boolean);
    const grupo = mesas.length > 1 ? mesas.map((m) => m.numero) : [];
    mesas.forEach((m, i) => porMesa.set(String(m._id), { comandaId: c._id, grupo, principal: i === 0 }));
  }
  return porMesa;
};

const serializarTodas = async (mesas) => {
  const abiertas = await comandasAbiertas();
  return mesas.map((m) => {
    const cuenta = abiertas.get(String(m._id));
    return toMesa(m, cuenta?.comandaId, cuenta);
  });
};

const buscarMesa = async (id) => {
  const mesa = await Mesa.findById(id);
  if (!mesa) throw new HttpError(404, "Mesa no encontrada");
  return mesa;
};

const duplicada = (err, numero) =>
  err.code === 11000 ? new HttpError(409, `Ya existe la mesa ${numero}`) : err;

// Cuentas (abiertas o no) en las que participa una mesa, sola o juntada.
const deLaMesa = (mesaId) => ({ $or: [{ mesa_id: mesaId }, { mesas_extra: mesaId }] });

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
  avisarMesas();
  res.json(toMesa(mesa));
};

const editar = async (req, res) => {
  const datos = req.valid.body;
  const previa = await buscarMesa(req.valid.params.id);
  const abierta = await Comanda.exists({ ...deLaMesa(previa._id), estado: "ABIERTA" });
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
  avisarMesas();
  res.json(toMesa(previa, abierta?._id));
};

const eliminar = async (req, res) => {
  const mesa = await buscarMesa(req.valid.params.id);
  const comandas = await Comanda.countDocuments(deLaMesa(mesa._id));
  if (comandas > 0) {
    throw new HttpError(
      409,
      `La mesa ${mesa.numero} ya tiene ${comandas} comanda(s) registradas. Desactívala en vez de borrarla.`
    );
  }
  await mesa.deleteOne();
  await registrar(req.usuario, "ELIMINAR_MESA", `Eliminó la mesa ${mesa.numero}`, SERVICIO.COMANDAS);
  avisarMesas();
  res.status(204).end();
};

module.exports = { mesaSchema, listar, listarTodas, crear, editar, eliminar };
