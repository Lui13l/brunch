const { Reservation } = require("../models");
const { HttpError, pick } = require("../utils/http");
const { verificarDueno } = require("../middleware/auth");
const { errorHorarioReserva } = require("../utils/horarioReservas");
const {
  MAX_PERSONAS_POR_HORARIO,
  crearConCapacidad,
  actualizarConCapacidad,
} = require("../services/reservas");

const { TRANSICIONES } = Reservation;

const buscarReserva = async (id) => {
  const reserva = await Reservation.findById(id);
  if (!reserva) throw new HttpError(404, "Reserva no encontrada");
  return reserva;
};

// Condicional sobre el estado leído: dos cambios simultáneos no se pisan.
const aplicarEstado = async (reserva, estado) => {
  const anterior = reserva.estado_reserva;
  if (!TRANSICIONES[anterior]?.includes(estado)) {
    throw new HttpError(400, `No se puede pasar de "${anterior}" a "${estado}"`);
  }
  const actualizada = await Reservation.findOneAndUpdate(
    { _id: reserva._id, estado_reserva: anterior },
    { $set: { estado_reserva: estado } },
    { returnDocument: "after" }
  );
  if (!actualizada) throw new HttpError(409, "La reserva cambió mientras tanto. Recarga e inténtalo de nuevo.");
  return actualizada;
};

const crear = async (req, res) => {
  const datos = pick(req.body, ["dia", "hora", "ocasion", "detalles", "cupo"]);

  const errorHorario = errorHorarioReserva(datos.dia, datos.hora);
  if (errorHorario) throw new HttpError(400, errorHorario);
  if (!Number.isInteger(datos.cupo) || datos.cupo < 1) {
    throw new HttpError(400, "El cupo debe ser un número entero mayor que cero");
  }
  if (datos.cupo > MAX_PERSONAS_POR_HORARIO) {
    throw new HttpError(400, `El máximo es de ${MAX_PERSONAS_POR_HORARIO} personas por horario`);
  }

  const reserva = await crearConCapacidad(datos, req.usuario._id);
  if (!reserva) throw new HttpError(409, "No hay suficiente cupo disponible para ese horario");
  res.status(201).json(reserva);
};

const actualizar = async (req, res) => {
  const datos = pick(req.body, ["dia", "hora", "cupo"]);
  const errorHorario = errorHorarioReserva(datos.dia, datos.hora);
  if (errorHorario) throw new HttpError(400, errorHorario);
  if (!Number.isInteger(datos.cupo) || datos.cupo < 1) {
    throw new HttpError(400, "El cupo debe ser un número entero mayor que cero");
  }
  if (datos.cupo > MAX_PERSONAS_POR_HORARIO) {
    throw new HttpError(400, `El máximo es de ${MAX_PERSONAS_POR_HORARIO} personas por horario`);
  }

  const reserva = await actualizarConCapacidad(req.params.id, req.usuario._id, datos);
  if (!reserva) throw new HttpError(409, "No hay suficiente cupo disponible para ese horario");
  res.json(reserva);
};

const misReservas = async (req, res) => {
  const reservas = await Reservation.find({ usuario_id: req.usuario._id }).sort({ dia: -1 });
  res.json(reservas);
};

// Admin. Filtros: ?fecha=YYYY-MM-DD y ?estado=pendiente
const listar = async (req, res) => {
  const filtro = {};
  if (req.query.estado) filtro.estado_reserva = req.query.estado;
  if (req.query.fecha) {
    const inicio = new Date(req.query.fecha);
    if (Number.isNaN(inicio.getTime())) throw new HttpError(400, "Fecha inválida");
    const fin = new Date(inicio);
    fin.setUTCDate(fin.getUTCDate() + 1);
    filtro.dia = { $gte: inicio, $lt: fin };
  }

  const reservas = await Reservation.find(filtro)
    .populate("usuario_id", "nombre correo celular")
    .sort({ dia: 1, hora: 1 });
  res.json(reservas);
};

const obtener = async (req, res) => {
  const reserva = await buscarReserva(req.params.id);
  verificarDueno(req, reserva.usuario_id);
  res.json(reserva);
};

const cambiarEstado = async (req, res) => {
  const reserva = await buscarReserva(req.params.id);
  res.json(await aplicarEstado(reserva, req.body?.estado));
};

const cancelar = async (req, res) => {
  const reserva = await buscarReserva(req.params.id);
  verificarDueno(req, reserva.usuario_id);
  res.json(await aplicarEstado(reserva, "cancelada"));
};

module.exports = { crear, actualizar, misReservas, listar, obtener, cambiarEstado, cancelar };
