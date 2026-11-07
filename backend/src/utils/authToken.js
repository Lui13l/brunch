const { createHash, randomUUID } = require("node:crypto");
const jwt = require("jsonwebtoken");

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

const generarToken = (usuario) =>
  jwt.sign({ id: usuario._id, rol: usuario.rol_id, jti: randomUUID() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

module.exports = { hashToken, generarToken };
