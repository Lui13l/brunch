// Etiquetas de los datos que crean las pruebas end-to-end (Playwright) en la
// base compartida de Atlas. Todo lo que cumpla esto se puede borrar con
// `npm run e2e:limpiar -- --confirmar`; nada real debe usarlas.
// Prefijo [E2E] en nombres: insumos, platos, categorías, domiciliarios e intenciones del chatbot.
const E2E = Object.freeze({
  correo: /@e2e\.brunch\.test$/i,
  prefijo: /^\[E2E\]/,
  mesaNombre: /^E2E/,
  mesaNumeroMinimo: 900,
  // Detalles de auditoría que mencionan datos e2e (aunque los escriba el admin real).
  detalle: /@e2e\.brunch\.test|\[E2E\]|mesa 9\d\d\b/i,
});

module.exports = E2E;
