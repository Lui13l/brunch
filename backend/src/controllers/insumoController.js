const { z } = require("zod");
const { Insumo, RecetaItem, MovimientoInventario } = require("../models");
const { HttpError } = require("../utils/http");
const { texto, textoOpcional } = require("../utils/validar");
const { toInsumo, toMovimiento } = require("../utils/serializar");
const { conTransaccion } = require("../utils/transaccion");
const { redondear3 } = require("../utils/dinero");
const { aplicarMovimiento } = require("../services/inventario");
const { registrar, SERVICIO } = require("../services/auditoria");

// Las cantidades del inventario llevan 3 decimales.
const cantidad = (campo, { minimo = 0 } = {}) =>
  z.coerce
    .number({ error: `${campo} es obligatorio` })
    .min(minimo, `${campo} no puede ser menor que ${minimo}`)
    .max(9_999_999, `${campo} es demasiado alto`)
    .transform(redondear3);

const crearInsumoSchema = z.object({
  nombre: texto("El nombre"),
  unidad: z.enum(Insumo.UNIDADES, { error: "La unidad debe ser G, ML o UND" }),
  stock: cantidad("El stock").default(0),
  stockMinimo: cantidad("El stock mínimo").default(0),
  activo: z.boolean().default(true),
});

// Al editar no se toca el stock: para eso están los ajustes, que dejan rastro.
const editarInsumoSchema = crearInsumoSchema.omit({ stock: true });

const ajusteSchema = z
  .object({
    cantidad: z.coerce
      .number({ error: "La cantidad es obligatoria" })
      .transform(redondear3)
      .refine((v) => v !== 0, "La cantidad no puede ser cero")
      .refine((v) => Math.abs(v) <= 9_999_999, "La cantidad es demasiado alta"),
    tipo: z.enum(["COMPRA", "AJUSTE"], { error: "El tipo debe ser COMPRA o AJUSTE" }).default("AJUSTE"),
    motivo: textoOpcional("El motivo"),
  })
  .refine((v) => v.tipo !== "AJUSTE" || v.motivo, {
    error: "Un ajuste manual necesita un motivo",
    path: ["motivo"],
  });

const buscar = async (id) => {
  const insumo = await Insumo.findById(id);
  if (!insumo) throw new HttpError(404, "Insumo no encontrado");
  return insumo;
};

const listar = async (req, res) => {
  res.json((await Insumo.find().sort({ nombre: 1 }).lean()).map(toInsumo));
};

const crear = async (req, res) => {
  const { stock, stockMinimo, ...datos } = req.valid.body;

  // Se crea en cero y el stock inicial entra como movimiento: así el libro y el
  // saldo cuadran desde el primer día.
  const insumo = await conTransaccion(async (session) => {
    const [creado] = await Insumo.create([{ ...datos, stock_minimo: stockMinimo, stock: 0 }], { session });
    if (stock === 0) return creado;
    return aplicarMovimiento(session, {
      insumoId: creado._id,
      tipo: "COMPRA",
      cantidad: stock,
      motivo: "Stock inicial",
      usuarioId: req.usuario._id,
    });
  });

  await registrar(req.usuario, "CREAR_INSUMO", `Creó el insumo "${insumo.nombre}"`, SERVICIO.INVENTARIO);
  res.json(toInsumo(insumo));
};

const editar = async (req, res) => {
  const insumo = await buscar(req.valid.params.id);
  const { stockMinimo, ...datos } = req.valid.body;
  Object.assign(insumo, datos, { stock_minimo: stockMinimo });
  await insumo.save();
  await registrar(req.usuario, "EDITAR_INSUMO", `Editó el insumo "${insumo.nombre}"`, SERVICIO.INVENTARIO);
  res.json(toInsumo(insumo));
};

// Solo se borra lo que no tiene historia; el resto se desactiva.
const eliminar = async (req, res) => {
  const insumo = await buscar(req.valid.params.id);
  const [enRecetas, conMovimientos] = await Promise.all([
    RecetaItem.countDocuments({ insumo_id: insumo._id }),
    MovimientoInventario.countDocuments({ insumo_id: insumo._id }),
  ]);
  if (enRecetas > 0) {
    throw new HttpError(409, `"${insumo.nombre}" se usa en ${enRecetas} receta(s). Quítalo de ellas o desactívalo.`);
  }
  if (conMovimientos > 0) {
    throw new HttpError(409, `"${insumo.nombre}" ya tiene movimientos registrados. Desactívalo en vez de borrarlo.`);
  }
  await insumo.deleteOne();
  await registrar(req.usuario, "ELIMINAR_INSUMO", `Eliminó el insumo "${insumo.nombre}"`, SERVICIO.INVENTARIO);
  res.status(204).end();
};

const ajustar = async (req, res) => {
  const { cantidad: delta, tipo, motivo } = req.valid.body;
  const previo = await buscar(req.valid.params.id);

  const insumo = await conTransaccion((session) =>
    aplicarMovimiento(session, { insumoId: previo._id, tipo, cantidad: delta, motivo, usuarioId: req.usuario._id })
  );

  const signo = delta > 0 ? "+" : "";
  await registrar(
    req.usuario,
    "AJUSTAR_STOCK",
    `${tipo} de ${signo}${delta} ${previo.unidad} en "${previo.nombre}"${motivo ? `: ${motivo}` : ""}`,
    SERVICIO.INVENTARIO
  );
  res.json(toInsumo(insumo));
};

const movimientos = async (req, res) => {
  const insumo = await buscar(req.valid.params.id);
  const lista = await MovimientoInventario.find({ insumo_id: insumo._id })
    .sort({ fecha: -1, _id: -1 })
    .limit(100)
    .lean();
  res.json(lista.map((m) => toMovimiento(m, insumo)));
};

module.exports = {
  crearInsumoSchema,
  editarInsumoSchema,
  ajusteSchema,
  cantidad,
  listar,
  crear,
  editar,
  eliminar,
  ajustar,
  movimientos,
};
