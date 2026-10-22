const { ChatConversation, ChatIntent } = require("../models");
const { HttpError, pick } = require("../utils/http");
const { esAdmin, verificarDueno } = require("../middleware/auth");
const chatbot = require("../services/chatbot");

const MAX_LARGO_MENSAJE = 500;

// Sin conversacion_id se continúa la última conversación activa del usuario,
// o se crea una nueva si no tiene ninguna.
const obtenerConversacion = async (req, conversacionId) => {
  if (conversacionId) {
    const conversacion = await ChatConversation.findById(conversacionId);
    if (!conversacion) throw new HttpError(404, "Conversación no encontrada");
    verificarDueno(req, conversacion.usuario_id);
    if (conversacion.estado !== "activa") {
      throw new HttpError(400, `La conversación está ${conversacion.estado}`);
    }
    return conversacion;
  }

  const activa = await ChatConversation.findOne({
    usuario_id: req.usuario._id,
    estado: "activa",
  }).sort({ fecha_ultima_actividad: -1 });

  return activa || new ChatConversation({ usuario_id: req.usuario._id });
};

const enviarMensaje = async (req, res) => {
  const mensaje = typeof req.body?.mensaje === "string" ? req.body.mensaje.trim() : "";
  if (!mensaje) throw new HttpError(400, "El mensaje es obligatorio");
  if (mensaje.length > MAX_LARGO_MENSAJE) {
    throw new HttpError(400, `El mensaje no puede superar ${MAX_LARGO_MENSAJE} caracteres`);
  }

  const conversacion = await obtenerConversacion(req, req.body.conversacion_id);
  const { intencion, respuesta } = await chatbot.responder(mensaje, req.usuario);
  const ahora = new Date();

  conversacion.mensajes.push(
    { tipo: "usuario", mensaje, intencion, fecha_hora: ahora },
    { tipo: "bot", mensaje: respuesta, intencion, fecha_hora: ahora }
  );
  conversacion.fecha_ultima_actividad = ahora;
  conversacion.contexto = { datos: { ...conversacion.contexto?.datos, ultima_intencion: intencion } };
  await conversacion.save();

  res.json({ conversacion_id: conversacion.id, intencion, respuesta });
};

// Las propias. Un admin puede ver todas con ?todas=true. Filtro: ?estado=
const listarConversaciones = async (req, res) => {
  const filtro = pick(req.query, ["estado"]);
  if (!(esAdmin(req) && req.query.todas === "true")) filtro.usuario_id = req.usuario._id;

  const conversaciones = await ChatConversation.find(filtro)
    .select("-mensajes")
    .sort({ fecha_ultima_actividad: -1 });
  res.json(conversaciones);
};

const obtenerConversacionPorId = async (req, res) => {
  const conversacion = await ChatConversation.findById(req.params.id);
  if (!conversacion) throw new HttpError(404, "Conversación no encontrada");
  verificarDueno(req, conversacion.usuario_id);
  res.json(conversacion);
};

const finalizarConversacion = async (req, res) => {
  const conversacion = await ChatConversation.findById(req.params.id);
  if (!conversacion) throw new HttpError(404, "Conversación no encontrada");
  verificarDueno(req, conversacion.usuario_id);
  if (conversacion.estado !== "activa") {
    throw new HttpError(400, `La conversación ya está ${conversacion.estado}`);
  }

  conversacion.estado = "finalizada";
  await conversacion.save();
  res.json(conversacion);
};

const CAMPOS_INTENCION = ["nombre", "descripcion", "activa", "palabras_clave", "respuestas"];

const listarIntenciones = async (req, res) => {
  const intenciones = await ChatIntent.find().sort({ nombre: 1 });
  res.json(intenciones);
};

const crearIntencion = async (req, res) => {
  const intencion = await ChatIntent.create(pick(req.body, CAMPOS_INTENCION));
  res.status(201).json(intencion);
};

const actualizarIntencion = async (req, res) => {
  const intencion = await ChatIntent.findByIdAndUpdate(
    req.params.id,
    pick(req.body, CAMPOS_INTENCION),
    { returnDocument: "after", runValidators: true }
  );
  if (!intencion) throw new HttpError(404, "Intención no encontrada");
  res.json(intencion);
};

// Las conversaciones guardan el nombre de la intención como texto,
// así que borrarla no rompe el historial.
const eliminarIntencion = async (req, res) => {
  const intencion = await ChatIntent.findByIdAndDelete(req.params.id);
  if (!intencion) throw new HttpError(404, "Intención no encontrada");
  res.status(204).end();
};

module.exports = {
  enviarMensaje,
  listarConversaciones,
  obtenerConversacionPorId,
  finalizarConversacion,
  listarIntenciones,
  crearIntencion,
  actualizarIntencion,
  eliminarIntencion,
};
