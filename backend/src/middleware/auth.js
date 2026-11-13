const jwt = require("jsonwebtoken");
const { User, RevokedToken } = require("../models");
const { HttpError } = require("../utils/http");
const { hashToken } = require("../utils/authToken");
const { ROL } = require("../utils/roles");

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

  if (await RevokedToken.exists({ tokenHash: hashToken(token) })) {
    throw new HttpError(401, "Token inválido o expirado");
  }

  const usuario = await User.findById(payload.id);
  if (!usuario) throw new HttpError(401, "El usuario del token ya no existe");
  if (usuario.activo === false) throw new HttpError(401, "La cuenta está desactivada");
  const cambio = usuario.credenciales_cambiadas_en;
  if (cambio && payload.iat < Math.floor(cambio.getTime() / 1000)) {
    throw new HttpError(401, "Tu sesión ya no es válida. Vuelve a iniciar sesión.");
  }
  return { usuario, payload };
};

// Exige un token válido y deja el usuario en req.usuario.
const auth = async (req, res, next) => {
  const token = leerToken(req);
  if (!token) throw new HttpError(401, "Se requiere autenticación");
  const { usuario, payload } = await cargarUsuario(token);
  req.usuario = usuario;
  req.authToken = {
    value: token,
    expiresAt: new Date(payload.exp * 1000),
  };
  next();
};

// Si hay token lo valida, si no hay sigue como visitante.
const authOpcional = async (req, res, next) => {
  const token = leerToken(req);
  if (token) {
    const { usuario } = await cargarUsuario(token);
    req.usuario = usuario;
  }
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

const esAdmin = (req) => req.usuario?.rol_id === ROL.ADMIN;

// Lanza 403 si el recurso no pertenece al usuario (los admin pueden todo).
const verificarDueno = (req, usuarioId) => {
  if (!esAdmin(req) && String(usuarioId) !== String(req.usuario._id)) {
    throw new HttpError(403, "No tienes permisos sobre este recurso");
  }
};

module.exports = { auth, authOpcional, requireRole, esAdmin, verificarDueno, cargarUsuario };
