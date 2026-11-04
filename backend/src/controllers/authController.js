const { randomBytes, randomUUID } = require("node:crypto");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { User, RevokedToken } = require("../models");
const { HttpError, pick } = require("../utils/http");
const { hashToken } = require("../utils/authToken");

const googleClient = new OAuth2Client();

const generarToken = (usuario) =>
  jwt.sign({ id: usuario._id, rol: usuario.rol_id, jti: randomUUID() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const registro = async (req, res) => {
  const datos = pick(req.body, ["nombre", "correo", "password", "direccion", "celular"]);
  const usuario = await User.create({ ...datos, rol_id: "cliente" });

  res.status(201).json({ token: generarToken(usuario), usuario });
};

const login = async (req, res) => {
  const { correo, password } = req.body || {};
  if (!correo || !password) {
    throw new HttpError(400, "Correo y contraseña son obligatorios");
  }

  const usuario = await User.findOne({ correo: String(correo).toLowerCase().trim() }).select("+password");
  if (!usuario || !(await usuario.compararPassword(String(password)))) {
    throw new HttpError(401, "Correo o contraseña incorrectos");
  }

  res.json({ token: generarToken(usuario), usuario });
};

const loginGoogle = async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new HttpError(503, "El inicio de sesión con Google no está configurado");
  }

  const { credential } = req.body || {};
  if (typeof credential !== "string" || !credential.trim()) {
    throw new HttpError(400, "La credencial de Google es obligatoria");
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch (error) {
    if (error.name === "GaxiosError") throw error;
    throw new HttpError(401, "La credencial de Google no es válida");
  }

  if (!payload?.email || payload.email_verified !== true) {
    throw new HttpError(401, "La cuenta de Google debe tener un correo verificado");
  }

  const correo = payload.email.toLowerCase().trim();
  let usuario = await User.findOne({ correo });
  if (!usuario) {
    usuario = await User.create({
      nombre: payload.name?.trim() || correo.split("@")[0],
      correo,
      password: randomBytes(32).toString("hex"),
      rol_id: "cliente",
    });
  }

  res.json({ token: generarToken(usuario), usuario });
};

const perfil = async (req, res) => {
  res.json(req.usuario);
};

const logout = async (req, res) => {
  await RevokedToken.create({
    tokenHash: hashToken(req.authToken.value),
    expiresAt: req.authToken.expiresAt,
  });

  res.json({ mensaje: "Sesión cerrada correctamente" });
};

module.exports = { registro, login, loginGoogle, perfil, logout };
