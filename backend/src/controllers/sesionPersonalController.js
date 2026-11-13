const { User } = require("../models");
const { HttpError } = require("../utils/http");
const { generarToken } = require("../utils/authToken");
const { toUsuarioPersonal } = require("../utils/serializar");

// Login de la app de comandas: mismo contrato que la API anterior
// (POST /api/usuarios/login {email, password} -> usuario plano + token).
// Cualquier fallo, incluida una cuenta desactivada, es un 401 genérico.
const loginPersonal = async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string") {
    throw new HttpError(401, "Credenciales incorrectas");
  }

  const usuario = await User.findOne({ correo: email.toLowerCase().trim() }).select("+password");
  if (!usuario || usuario.activo === false || !(await usuario.compararPassword(password))) {
    throw new HttpError(401, "Credenciales incorrectas");
  }

  res.json({ ...toUsuarioPersonal(usuario), token: generarToken(usuario) });
};

module.exports = { loginPersonal };
