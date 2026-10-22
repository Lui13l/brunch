const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { HttpError } = require("../utils/http");

const leerToken = (req) => {
  const header = req.headers.authorization || "";
  const [tipo, token] = header.split(" ");
  return tipo === "Bearer" && token ? token : null;
};

const cargarUsuario = async (token) => {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, "Token inválido o expirado");
  }

  const usuario = await User.findById(payload.id);
  if (!usuario) throw new HttpError(401, "El usuario del token ya no existe");
  return usuario;
};

// Exige un token válido y deja el usuario en req.usuario.
const auth = async (req, res, next) => {
  const token = leerToken(req);
  if (!token) throw new HttpError(401, "Se requiere autenticación");
  req.usuario = await cargarUsuario(token);
  next();
};

// Si hay token lo valida, si no hay sigue como visitante.
const authOpcional = async (req, res, next) => {
  const token = leerToken(req);
  if (token) req.usuario = await cargarUsuario(token);
  next();
};

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol_id)) {
      throw new HttpError(403, "No tienes permisos para esta acción");
    }
    next();
  };

const esAdmin = (req) => req.usuario?.rol_id === "admin";

// Lanza 403 si el recurso no pertenece al usuario (los admin pueden todo).
const verificarDueno = (req, usuarioId) => {
  if (!esAdmin(req) && String(usuarioId) !== String(req.usuario._id)) {
    throw new HttpError(403, "No tienes permisos sobre este recurso");
  }
};

module.exports = { auth, authOpcional, requireRole, esAdmin, verificarDueno };
