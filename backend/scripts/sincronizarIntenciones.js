// Lleva a la base las intenciones del chatbot que falten respecto a
// src/data/intenciones.js, sin pisar lo que el admin haya editado.
//   npm run chat:sincronizar                 -> solo muestra lo que cambiaría
//   npm run chat:sincronizar -- --confirmar  -> lo aplica
//
// Qué hace:
//  - Crea las intenciones que no existen (por nombre).
//  - A las que ya existen les AGREGA las palabras clave nuevas.
// Qué no hace: no borra intenciones ni palabras clave, y no toca respuestas,
// descripciones ni el interruptor "activa".
const INTENCIONES = require("../src/data/intenciones");
const { ChatIntent } = require("../src/models");
const { normalizar } = require("../src/services/chatbot");

const sincronizarIntenciones = async ({ confirmar = false } = {}) => {
  const existentes = new Map((await ChatIntent.find().lean()).map((i) => [i.nombre, i]));
  const cambios = [];

  for (const intencion of INTENCIONES) {
    const actual = existentes.get(intencion.nombre);
    if (!actual) {
      cambios.push({ intencion: intencion.nombre, cambio: "crear", detalle: `${intencion.palabras_clave.length} palabras clave` });
      if (confirmar) await ChatIntent.create(intencion);
      continue;
    }

    // Se comparan normalizadas: "Menú" y "menu" son la misma palabra clave.
    const yaEstan = new Set(actual.palabras_clave.map(normalizar));
    const nuevas = intencion.palabras_clave.filter((clave) => !yaEstan.has(normalizar(clave)));
    if (nuevas.length === 0) continue;

    cambios.push({ intencion: intencion.nombre, cambio: "agregar palabras clave", detalle: nuevas.join(", ") });
    if (confirmar) {
      await ChatIntent.updateOne({ _id: actual._id }, { $addToSet: { palabras_clave: { $each: nuevas } } });
    }
  }
  return cambios;
};

module.exports = { sincronizarIntenciones };

if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");
  const connectDB = require("../src/config/database");
  const confirmar = process.argv.includes("--confirmar");

  (async () => {
    await connectDB();
    const cambios = await sincronizarIntenciones({ confirmar });
    if (cambios.length === 0) {
      console.log("El chatbot ya está al día: no hay nada que sincronizar.");
    } else {
      console.log(confirmar ? "Cambios aplicados:" : "Cambios pendientes (simulación, usa --confirmar para aplicarlos):");
      console.table(cambios);
    }
    await mongoose.disconnect();
  })().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
}
