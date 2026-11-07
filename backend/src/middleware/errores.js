// Las rutas del personal (app de comandas) responden los errores en texto
// plano, como la API anterior; las de la web siguen respondiendo JSON {mensaje}.
const enTexto = (req, res, next) => {
  req.erroresEnTexto = true;
  next();
};

const responder = (req, res, status, mensaje, errores) => {
  if (req.erroresEnTexto) {
    return res.status(status).type("text/plain").send(errores?.[0] || mensaje);
  }
  return res.status(status).json(errores ? { mensaje, errores } : { mensaje });
};

const noEncontrado = (req, res) =>
  responder(req, res, 404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`);

// Traduce cualquier error a { status, mensaje, errores? }.
const clasificar = (err) => {
  if (err.name === "ValidationError") {
    return { status: 400, mensaje: "Datos inválidos", errores: Object.values(err.errors).map((e) => e.message) };
  }
  if (err.name === "CastError") return { status: 400, mensaje: `Valor inválido para ${err.path}` };
  if (err.code === 11000) {
    const campo = Object.keys(err.keyValue || err.keyPattern || {})[0];
    return { status: 409, mensaje: `Ya existe un registro con ese ${campo}` };
  }
  if (err.type === "entity.parse.failed") return { status: 400, mensaje: "El cuerpo de la petición no es JSON válido" };
  if (err.type === "entity.too.large") return { status: 413, mensaje: "La petición es demasiado grande" };

  const status = err.status || 500;
  return { status, mensaje: status === 500 ? "Error interno del servidor" : err.message };
};

// eslint-disable-next-line no-unused-vars
const manejarErrores = (err, req, res, next) => {
  const { status, mensaje, errores } = clasificar(err);
  if (status === 500) console.error(err);
  responder(req, res, status, mensaje, errores);
};

module.exports = { enTexto, noEncontrado, manejarErrores, clasificar };
