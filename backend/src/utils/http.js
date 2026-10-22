class HttpError extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

// Devuelve solo los campos permitidos del body (evita que el cliente
// asigne campos sensibles como rol_id, estado o total).
const pick = (obj = {}, campos) =>
  Object.fromEntries(
    campos.filter((c) => obj[c] !== undefined).map((c) => [c, obj[c]])
  );

module.exports = { HttpError, pick };
