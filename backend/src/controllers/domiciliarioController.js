const { DeliveryPerson } = require("../models");
const { HttpError, pick } = require("../utils/http");

const CAMPOS = ["nombre", "apellido", "estado"];

const actualizarPorId = async (id, datos) => {
  const domiciliario = await DeliveryPerson.findByIdAndUpdate(id, datos, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!domiciliario) throw new HttpError(404, "Domiciliario no encontrado");
  return domiciliario;
};

const listar = async (req, res) => {
  const filtro = pick(req.query, ["estado"]);
  const domiciliarios = await DeliveryPerson.find(filtro).sort({ nombre: 1 });
  res.json(domiciliarios);
};

const obtener = async (req, res) => {
  const domiciliario = await DeliveryPerson.findById(req.params.id);
  if (!domiciliario) throw new HttpError(404, "Domiciliario no encontrado");
  res.json(domiciliario);
};

const crear = async (req, res) => {
  const domiciliario = await DeliveryPerson.create(pick(req.body, CAMPOS));
  res.status(201).json(domiciliario);
};

const actualizar = async (req, res) => {
  res.json(await actualizarPorId(req.params.id, pick(req.body, CAMPOS)));
};

const cambiarEstado = async (req, res) => {
  if (!req.body?.estado) throw new HttpError(400, "El estado es obligatorio");
  res.json(await actualizarPorId(req.params.id, { estado: req.body.estado }));
};

// Se marca como inactivo para no romper los pedidos que lo referencian.
const eliminar = async (req, res) => {
  res.json(await actualizarPorId(req.params.id, { estado: "inactivo" }));
};

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, eliminar };
