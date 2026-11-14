const mongoose = require("mongoose");
const { Reservation, ReservationSlot } = require("../models");
const { conTransaccion } = require("../utils/transaccion");
const { HttpError } = require("../utils/http");
const { errorHorarioReserva } = require("../utils/horarioReservas");

const MAX_PERSONAS_POR_HORARIO = 30;
const ESTADOS_QUE_OCUPAN_CUPO = ["pendiente", "confirmada"];

const fechaReserva = (dia) => new Date(`${dia}T00:00:00.000Z`);

const consultarOcupacion = async (dia, hora, session, excluirId) => {
  const filtro = {
    dia: fechaReserva(dia),
    hora,
    estado_reserva: { $in: ESTADOS_QUE_OCUPAN_CUPO },
  };
  if (excluirId) filtro._id = { $ne: new mongoose.Types.ObjectId(excluirId) };
  let consulta = Reservation.aggregate([
    { $match: filtro },
    { $group: { _id: null, personas: { $sum: "$cupo" } } },
  ]);
  if (session) consulta = consulta.session(session);
  const [resultado] = await consulta;
  return resultado?.personas || 0;
};

const consultarDisponibilidad = async (dia, hora, excluirId) => {
  const ocupadas = await consultarOcupacion(dia, hora, null, excluirId);
  return {
    disponibles: Math.max(0, MAX_PERSONAS_POR_HORARIO - ocupadas),
    capacidad: MAX_PERSONAS_POR_HORARIO,
  };
};

const asegurarBloqueoHorario = async (dia, hora) => {
  try {
    await ReservationSlot.updateOne(
      { dia: fechaReserva(dia), hora },
      { $setOnInsert: { dia: fechaReserva(dia), hora, revision: 0 } },
      { upsert: true }
    );
  } catch (error) {
    // Otra petición pudo crear el mismo bloqueo de horario al mismo tiempo.
    if (error.code !== 11000) throw error;
  }
};

const crearConCapacidad = async ({ dia, hora, cupo, ...datos }, usuarioId) => {
  const errorHorario = errorHorarioReserva(dia, hora);
  if (errorHorario) throw new HttpError(400, errorHorario);
  await asegurarBloqueoHorario(dia, hora);

  return conTransaccion(async (session) => {
    const bloqueo = await ReservationSlot.updateOne(
      { dia: fechaReserva(dia), hora },
      { $inc: { revision: 1 } },
      { session }
    );
    if (bloqueo.matchedCount !== 1) {
      throw new Error("No se pudo bloquear el horario de la reserva");
    }

    const ocupadas = await consultarOcupacion(dia, hora, session);
    if (ocupadas + cupo > MAX_PERSONAS_POR_HORARIO) return null;

    const [reserva] = await Reservation.create(
      [{ ...datos, dia: fechaReserva(dia), hora, cupo, usuario_id: usuarioId }],
      { session }
    );
    return reserva;
  });
};

const cancelarPropia = async (reservaId, usuarioId) =>
  Reservation.findOneAndUpdate(
    {
      _id: reservaId,
      usuario_id: usuarioId,
      estado_reserva: { $in: ["pendiente", "confirmada"] },
    },
    { $set: { estado_reserva: "cancelada" } },
    { returnDocument: "after" }
  );

const actualizarConCapacidad = async (reservaId, usuarioId, datos) => {
  const errorHorario = errorHorarioReserva(datos.dia, datos.hora);
  if (errorHorario) throw new HttpError(400, errorHorario);
  await asegurarBloqueoHorario(datos.dia, datos.hora);

  return conTransaccion(async (session) => {
    const reserva = await Reservation.findOne({
      _id: reservaId,
      usuario_id: usuarioId,
    }).session(session);
    if (!reserva) throw new HttpError(404, "Reserva no encontrada");
    if (!ESTADOS_QUE_OCUPAN_CUPO.includes(reserva.estado_reserva)) {
      throw new HttpError(400, "Solo puedes editar reservas pendientes o confirmadas");
    }

    const bloqueo = await ReservationSlot.updateOne(
      { dia: fechaReserva(datos.dia), hora: datos.hora },
      { $inc: { revision: 1 } },
      { session }
    );
    if (bloqueo.matchedCount !== 1) {
      throw new Error("No se pudo bloquear el horario de la reserva");
    }

    const ocupadas = await consultarOcupacion(datos.dia, datos.hora, session, reserva._id);
    if (ocupadas + datos.cupo > MAX_PERSONAS_POR_HORARIO) return null;

    const actualizada = await Reservation.findOneAndUpdate(
      {
        _id: reserva._id,
        usuario_id: usuarioId,
        estado_reserva: { $in: ESTADOS_QUE_OCUPAN_CUPO },
        updatedAt: reserva.updatedAt,
      },
      { $set: datos },
      { returnDocument: "after", runValidators: true, session }
    );
    if (!actualizada) {
      throw new HttpError(409, "La reserva cambió mientras tanto. Recarga e inténtalo de nuevo.");
    }
    return actualizada;
  });
};

module.exports = {
  MAX_PERSONAS_POR_HORARIO,
  consultarDisponibilidad,
  crearConCapacidad,
  cancelarPropia,
  actualizarConCapacidad,
};
