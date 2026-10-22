const noEncontrado = (req, res) => {
  res.status(404).json({ mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const manejarErrores = (err, req, res, next) => {
  if (err.name === "ValidationError") {
    const errores = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ mensaje: "Datos inválidos", errores });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ mensaje: `Valor inválido para ${err.path}` });
  }

  if (err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({ mensaje: `Ya existe un registro con ese ${campo}` });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ mensaje: "El cuerpo de la petición no es JSON válido" });
  }

  const status = err.status || 500;
  if (status === 500) console.error(err);

  res.status(status).json({
    mensaje: status === 500 ? "Error interno del servidor" : err.message,
  });
};

module.exports = { noEncontrado, manejarErrores };
