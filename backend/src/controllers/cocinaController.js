const { Comanda } = require("../models");
const { HttpError } = require("../utils/http");
const { toComandaItem } = require("../utils/serializar");
const { mismo, avisarSiLaMesaEstaCompleta } = require("../services/comandas");
const { publicar, TOPICS } = require("../ws/hub");

const { EN_COCINA } = Comanda;

// Pantalla de la cocina: solo platos de cuentas abiertas. Una cuenta cerrada a
// la fuerza ya canceló lo suyo y no debe dejar tickets en la cola.

const platoDeCocina = (comanda, item) => ({
  ...toComandaItem(item),
  comandaId: String(comanda._id),
  mesa: comanda.mesa_id?.numero ?? null,
});

const colaCocina = async (req, res) => {
  const comandas = await Comanda.find({ estado: "ABIERTA", "items.estado": { $in: EN_COCINA } })
    .populate("mesa_id", "numero")
    .lean();
  const platos = comandas.flatMap((c) => c.items.filter((i) => EN_COCINA.includes(i.estado)).map((i) => ({ c, i })));
  platos.sort((a, b) => new Date(a.i.fecha_envio) - new Date(b.i.fecha_envio));
  res.json(platos.map(({ c, i }) => platoDeCocina(c, i)));
};

const cambiarEstadoCocina = async (req, res) => {
  const itemId = req.valid.params.id;
  const { estado } = req.valid.body;

  const comanda = await Comanda.findOneAndUpdate(
    { estado: "ABIERTA", items: { $elemMatch: { _id: itemId, estado: { $in: EN_COCINA } } } },
    { $set: { "items.$.estado": estado, "items.$.fecha_listo": estado === "LISTO" ? new Date() : null } },
    { returnDocument: "after" }
  )
    .populate("mesa_id", "numero")
    .lean();

  if (!comanda) {
    const actual = await Comanda.findOne({ "items._id": itemId }, { estado: 1, "items.$": 1 }).lean();
    if (!actual) throw new HttpError(404, "Plato no encontrado");
    if (actual.estado !== "ABIERTA") throw new HttpError(409, `La comanda ya está ${actual.estado.toLowerCase()}`);
    throw new HttpError(409, `Ese plato ya está ${actual.items[0].estado.toLowerCase()}`);
  }

  const json = platoDeCocina(comanda, comanda.items.find((i) => mismo(i._id, itemId)));
  publicar(TOPICS.cocina, json);
  if (estado === "LISTO") {
    publicar(TOPICS.salon, json);
    publicar(TOPICS.mesero(comanda.mesero_id), json);
    avisarSiLaMesaEstaCompleta(comanda);
  }
  res.json(json);
};

module.exports = { colaCocina, cambiarEstadoCocina };
