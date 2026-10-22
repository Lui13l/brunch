const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const MINUTO = 60 * 1000;

const numeroEnv = (nombre, porDefecto) => Number(process.env[nombre]) || porDefecto;

// Login y registro: frena ataques de fuerza bruta. Solo cuentan los intentos
// fallidos, así que un usuario que entra bien no gasta su cupo.
const limiteAuth = rateLimit({
  windowMs: 15 * MINUTO,
  limit: numeroEnv("RATE_LIMIT_AUTH_MAX", 10),
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { mensaje: "Demasiados intentos. Espera unos minutos antes de volver a intentarlo." },
});

// Chatbot: cada mensaje escribe en la base de datos, así que se limita por usuario.
const limiteChat = rateLimit({
  windowMs: MINUTO,
  limit: numeroEnv("RATE_LIMIT_CHAT_MAX", 20),
  keyGenerator: (req) => (req.usuario ? `usuario:${req.usuario._id}` : ipKeyGenerator(req.ip)),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { mensaje: "Estás enviando mensajes muy rápido. Espera un momento." },
});

module.exports = { limiteAuth, limiteChat };
