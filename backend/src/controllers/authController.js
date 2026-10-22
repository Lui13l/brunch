const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { HttpError, pick } = require("../utils/http");

const generarToken = (usuario) =>
  jwt.sign({ id: usuario._id, rol: usuario.rol_id }, process.env.JWT_SECRET, {
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

const perfil = async (req, res) => {
  res.json(req.usuario);
};

module.exports = { registro, login, perfil };
