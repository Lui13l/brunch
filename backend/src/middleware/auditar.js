const { registrar } = require("../services/auditoria");

const codigo = (id) => `#${String(id ?? "").slice(-6).toUpperCase()}`;

// Audita una acción de admin de la web sin tocar su controlador: si la
// respuesta es exitosa (2xx), registra quién hizo qué justo antes de enviarla.
// `describir` recibe la petición y el cuerpo JSON respondido (vacío en un 204).
const auditar = (servicio, accion, describir) => (req, res, next) => {
  let cuerpo = {};
  const json = res.json.bind(res);
  res.json = (datos) => {
    cuerpo = datos ?? {};
    return json(datos);
  };

  const end = res.end.bind(res);
  res.end = (...args) => {
    if (res.statusCode >= 400 || !req.usuario) return end(...args);
    let detalle;
    try {
      detalle = describir(req, cuerpo);
    } catch {
      detalle = `${accion} ${codigo(req.params.id)}`;
    }
    // registrar nunca lanza (es de mejor esfuerzo).
    void registrar(req.usuario, accion, detalle, servicio).finally(() => end(...args));
    return res;
  };
  next();
};

module.exports = { auditar, codigo };
