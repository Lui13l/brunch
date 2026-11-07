const { User, Role } = require("../models");
const { HttpError, pick } = require("../utils/http");
const { cambiarCuenta } = require("./personalController");
const { desconectarUsuario } = require("../ws/hub");

const listar = async (req, res) => {
  const filtro = pick(req.query, ["rol_id"]);
  const usuarios = await User.find(filtro).sort({ createdAt: -1 });
  res.json(usuarios);
};

const obtener = async (req, res) => {
  const usuario = await User.findById(req.params.id);
  if (!usuario) throw new HttpError(404, "Usuario no encontrado");
  res.json(usuario);
};

const actualizarPerfil = async (req, res) => {
  const datos = pick(req.body, ["nombre", "direccion", "celular", "password"]);
  const usuario = await User.findById(req.usuario._id);

  // Se usa save() para que el hook de User hashee la contraseña nueva.
  Object.assign(usuario, datos);
  await usuario.save();

  res.json(usuario);
};

const cambiarRol = async (req, res) => {
  const { rol_id } = req.body || {};
  if (!rol_id || !(await Role.exists({ _id: rol_id }))) {
    throw new HttpError(400, "Rol inválido");
  }

  if (String(req.params.id) === String(req.usuario._id)) {
    throw new HttpError(409, "No puedes cambiar tu propio rol");
  }
  // Mismas garantías que la gestión de personal: siempre queda un admin activo
  // y la conexión en vivo de esa persona se corta para que tome el rol nuevo.
  const usuario = await cambiarCuenta(req.params.id, { rol_id });
  desconectarUsuario(usuario._id, 4403, "Cambió tu rol");
  res.json(usuario);
};

module.exports = { listar, obtener, actualizarPerfil, cambiarRol };
