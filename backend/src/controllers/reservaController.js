const { Reservation } = require("../models");
const { HttpError, pick } = require("../utils/http");
const { verificarDueno } = require("../middleware/auth");
const { diaCalendarioHoy } = require("../utils/tiempo");

const { TRANSICIONES } = Reservation;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

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

  if (datos.hora !== undefined && !HORA.test(datos.hora)) {
    throw new HttpError(400, "La hora debe tener formato HH:MM (24 horas)");
  }

  // "dia" llega como YYYY-MM-DD y se guarda como medianoche UTC de esa fecha;
  // se compara contra el día de hoy del restaurante (no el de UTC).
  if (datos.dia && new Date(datos.dia) < diaCalendarioHoy()) {
    throw new HttpError(400, "No se puede reservar en una fecha pasada");
  }

  const reserva = await Reservation.create({ ...datos, usuario_id: req.usuario._id });
  res.status(201).json(reserva);
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

module.exports = { crear, misReservas, listar, obtener, cambiarEstado, cancelar };
