// Lleva a la base las intenciones del chatbot que falten respecto a
// src/data/intenciones.js, sin pisar lo que el admin haya editado.
//   npm run chat:sincronizar                               -> solo muestra lo que cambiaría
//   npm run chat:sincronizar -- --confirmar                -> lo aplica
//   npm run chat:sincronizar -- --respuestas               -> incluye respuestas y sugerencias (simulación)
//   npm run chat:sincronizar -- --respuestas --confirmar   -> las aplica
//
// Qué hace:
//  - Crea las intenciones que no existen (por nombre).
//  - A las que ya existen les AGREGA las palabras clave nuevas.
//  - Con --respuestas, además les AGREGA las respuestas que no tengan y, si no
//    tienen ninguna sugerencia, les pone las del archivo.
// Qué no hace: no borra intenciones, palabras clave ni respuestas, y no toca
// descripciones ni el interruptor "activa". Sin --respuestas tampoco toca las
// respuestas ni las sugerencias.
const INTENCIONES = require("../src/data/intenciones");
const { ChatIntent } = require("../src/models");
const { normalizar } = require("../src/services/chatbot");

const sincronizarIntenciones = async ({ confirmar = false, respuestas = false } = {}) => {
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
    if (nuevas.length > 0) {
      cambios.push({ intencion: intencion.nombre, cambio: "agregar palabras clave", detalle: nuevas.join(", ") });
      if (confirmar) {
        await ChatIntent.updateOne({ _id: actual._id }, { $addToSet: { palabras_clave: { $each: nuevas } } });
      }
    }

    if (!respuestas) continue;

    // Las respuestas del admin se quedan: solo se suman las que no estén.
    const dichas = new Set((actual.respuestas ?? []).map((r) => normalizar(r.respuesta)));
    const otras = intencion.respuestas.filter((r) => !dichas.has(normalizar(r.respuesta)));
    if (otras.length > 0) {
      cambios.push({ intencion: intencion.nombre, cambio: "agregar respuestas", detalle: `${otras.length} nuevas` });
      if (confirmar) await ChatIntent.updateOne({ _id: actual._id }, { $push: { respuestas: { $each: otras } } });
    }

    // Las sugerencias solo se ponen donde no hay: si el admin dejó las suyas, mandan.
    const sugerencias = intencion.sugerencias ?? [];
    if (sugerencias.length > 0 && !(actual.sugerencias?.length > 0)) {
      cambios.push({ intencion: intencion.nombre, cambio: "poner sugerencias", detalle: sugerencias.join(" | ") });
      if (confirmar) await ChatIntent.updateOne({ _id: actual._id }, { $set: { sugerencias } });
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
  const respuestas = process.argv.includes("--respuestas");

  (async () => {
    await connectDB();
    const cambios = await sincronizarIntenciones({ confirmar, respuestas });
    if (cambios.length === 0) {
      console.log("El chatbot ya está al día: no hay nada que sincronizar.");
    } else {
      console.log(confirmar ? "Cambios aplicados:" : "Cambios pendientes (simulación, usa --confirmar para aplicarlos):");
      console.table(cambios);
    }
    if (!respuestas) console.log("Las respuestas y sugerencias nuevas no se revisaron: agrega --respuestas para incluirlas.");
    await mongoose.disconnect();
  })().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
}
