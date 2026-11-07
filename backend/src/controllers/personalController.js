const { z } = require("zod");
const { User, Role } = require("../models");
const { conTransaccion } = require("../utils/transaccion");
const { HttpError } = require("../utils/http");
const { texto, email, booleanoQuery } = require("../utils/validar");
const { toUsuarioPersonal } = require("../utils/serializar");
const { rolInterno, rolPublico, ROLES_PERSONAL } = require("../utils/roles");
const { registrar, SERVICIO } = require("../services/auditoria");
const { desconectarUsuario } = require("../ws/hub");

const ROLES_APP = ["ADMIN", "MESERO", "COCINA", "USUARIO"];
const password = z
  .string({ error: "La contraseña es obligatoria" })
  .min(6, "La contraseña debe tener al menos 6 caracteres")
  .max(128, "La contraseña es demasiado larga");

const listarSchema = z.object({
  rol: z.enum(ROLES_APP, { error: "Rol inválido" }).optional(),
  activo: booleanoQuery("activo").optional(),
});

// Desde aquí solo se crea personal del salón; los admin se promueven con /rol.
const crearSchema = z.object({
  nombre: texto("El nombre"),
  email,
  password,
  rol: z.enum(["MESERO", "COCINA"], { error: "El rol debe ser MESERO o COCINA" }),
});

const rolSchema = z.object({ rol: z.enum(ROLES_APP, { error: "Rol inválido" }) });
const activoSchema = z.object({ activo: z.boolean({ error: "'activo' debe ser verdadero o falso" }) });
const passwordSchema = z.object({ password });

const buscar = async (id) => {
  const usuario = await User.findById(id);
  if (!usuario) throw new HttpError(404, "Usuario no encontrado");
  return usuario;
};

const noAMiMismo = (req, usuario, mensaje) => {
  if (String(usuario._id) === String(req.usuario._id)) throw new HttpError(409, mensaje);
};

// Cambia rol o estado de una cuenta garantizando que quede al menos un admin
// activo. Toca un documento común (el rol admin) para que dos cambios
// simultáneos choquen y se ejecuten uno detrás del otro.
const cambiarCuenta = (usuarioId, cambios) =>
  conTransaccion(async (session) => {
    const usuario = await User.findByIdAndUpdate(usuarioId, { $set: cambios }, { session, returnDocument: "after" });
    if (!usuario) throw new HttpError(404, "Usuario no encontrado");
    await Role.updateOne({ _id: "admin" }, { $currentDate: { updatedAt: true } }, { session });
    const admins = await User.countDocuments({ rol_id: "admin", activo: { $ne: false } }).session(session);
    if (admins === 0) throw new HttpError(409, "Debe quedar al menos un administrador activo");
    return usuario;
  });

const listar = async (req, res) => {
  const { rol, activo } = req.valid.query;
  const filtro = { rol_id: rol ? rolInterno(rol) : { $in: ROLES_PERSONAL } };
  if (activo !== undefined) filtro.activo = activo ? { $ne: false } : false;
  const usuarios = await User.find(filtro).sort({ rol_id: 1, nombre: 1 }).lean();
  res.json(usuarios.map(toUsuarioPersonal));
};

const crear = async (req, res) => {
  const { nombre, email: correo, password: clave, rol } = req.valid.body;
  if (await User.exists({ correo })) throw new HttpError(409, "Ya existe una cuenta con ese correo");
  let usuario;
  try {
    usuario = await User.create({ nombre, correo, password: clave, rol_id: rolInterno(rol) });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, "Ya existe una cuenta con ese correo");
    throw err;
  }
  await registrar(req.usuario, "CREAR_CUENTA", `Creó la cuenta de ${rol.toLowerCase()} ${correo}`, SERVICIO.PERSONAL);
  res.json(toUsuarioPersonal(usuario));
};

const cambiarRol = async (req, res) => {
  const previo = await buscar(req.valid.params.id);
  noAMiMismo(req, previo, "No puedes cambiar tu propio rol");
  const anterior = rolPublico(previo.rol_id);
  const usuario = await cambiarCuenta(previo._id, { rol_id: rolInterno(req.valid.body.rol) });
  // La app debe volver a entrar para tomar los permisos nuevos.
  desconectarUsuario(usuario._id, 4403, "Cambió tu rol");
  await registrar(
    req.usuario,
    "CAMBIAR_ROL",
    `Cambió el rol de ${usuario.correo}: ${anterior} → ${req.valid.body.rol}`,
    SERVICIO.PERSONAL
  );
  res.json(toUsuarioPersonal(usuario));
};

const cambiarActivo = async (req, res) => {
  const previo = await buscar(req.valid.params.id);
  const { activo } = req.valid.body;
  if (!activo) noAMiMismo(req, previo, "No puedes desactivar tu propia cuenta");
  // Al desactivar se invalidan los tokens: reactivar no los revive.
  const usuario = await cambiarCuenta(previo._id, activo ? { activo } : { activo, credenciales_cambiadas_en: new Date() });
  if (!activo) desconectarUsuario(usuario._id, 4401, "Cuenta desactivada");
  await registrar(
    req.usuario,
    activo ? "REACTIVAR_CUENTA" : "DESACTIVAR_CUENTA",
    `${activo ? "Reactivó" : "Desactivó"} la cuenta de ${usuario.correo}`,
    SERVICIO.PERSONAL
  );
  res.json(toUsuarioPersonal(usuario));
};

const cambiarPassword = async (req, res) => {
  const usuario = await buscar(req.valid.params.id);
  usuario.password = req.valid.body.password; // el hook de User la hashea
  // Las sesiones abiertas con la contraseña anterior dejan de valer.
  usuario.credenciales_cambiadas_en = new Date();
  await usuario.save();
  desconectarUsuario(usuario._id, 4401, "Contraseña cambiada");
  await registrar(req.usuario, "CAMBIAR_CONTRASENA", `Cambió la contraseña de ${usuario.correo}`, SERVICIO.PERSONAL);
  res.json(toUsuarioPersonal(usuario));
};

module.exports = {
  cambiarCuenta,
  listarSchema,
  crearSchema,
  rolSchema,
  activoSchema,
  passwordSchema,
  listar,
  crear,
  cambiarRol,
  cambiarActivo,
  cambiarPassword,
};
