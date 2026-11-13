const mongoose = require("mongoose");

// Ejecuta fn(session) dentro de una transacción (Atlas es un replica set).
// El driver puede reintentar fn ante conflictos transitorios, así que fn no
// debe tener efectos externos: publicar por WebSocket o auditar va después.
const conTransaccion = async (fn) => {
  let resultado;
  await mongoose.connection.transaction(async (session) => {
    resultado = await fn(session);
  });
  return resultado;
};

module.exports = { conTransaccion };
