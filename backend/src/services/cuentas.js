const { User, Role } = require("../models");
const { conTransaccion } = require("../utils/transaccion");
const { HttpError } = require("../utils/http");
const { ROL } = require("../utils/roles");

// Cambia rol o estado de una cuenta garantizando que quede al menos un admin
// activo. Toca un documento común (el rol admin) para que dos cambios
// simultáneos choquen y se ejecuten uno detrás del otro.
// Lo usan /api/admin/personal (app del personal) y PATCH /api/usuarios/:id/rol (web).
const cambiarCuenta = (usuarioId, cambios) =>
  conTransaccion(async (session) => {
    await Role.updateOne({ _id: ROL.ADMIN }, { $currentDate: { updatedAt: true } }, { session });

    // El restaurante tiene un solo administrador: nadie más puede recibir ese
    // rol mientras exista otra cuenta que lo tenga (activa o no).
    if (cambios.rol_id === ROL.ADMIN) {
      const otro = await User.exists({ rol_id: ROL.ADMIN, _id: { $ne: usuarioId } }).session(session);
      if (otro) throw new HttpError(409, "Solo puede haber un administrador y ya existe uno");
    }

    const usuario = await User.findByIdAndUpdate(usuarioId, { $set: cambios }, { session, returnDocument: "after" });
    if (!usuario) throw new HttpError(404, "Usuario no encontrado");
    const admins = await User.countDocuments({ rol_id: ROL.ADMIN, activo: { $ne: false } }).session(session);
    if (admins === 0) throw new HttpError(409, "Debe quedar al menos un administrador activo");
    return usuario;
  });

module.exports = { cambiarCuenta };
