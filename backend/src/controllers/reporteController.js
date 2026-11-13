const { z } = require("zod");
const { Comanda, MovimientoInventario } = require("../models");
const { fecha } = require("../utils/validar");
const { id } = require("../utils/serializar");
const { redondear2, redondear3 } = require("../utils/dinero");
const { diaLocal, hoyLocal, inicioDiaLocal, rangoLocal } = require("../utils/tiempo");

const MAX_DIAS = 366;

// Rango inclusivo en los dos extremos ("del 1 al 30" incluye el 30), en días del restaurante.
const rangoSchema = z
  .object({ desde: fecha.optional(), hasta: fecha.optional() })
  .refine((v) => !v.desde || !v.hasta || v.desde <= v.hasta, {
    error: "La fecha inicial no puede ser posterior a la final",
    path: ["desde"],
  })
  .refine(
    (v) => !v.desde || !v.hasta || inicioDiaLocal(v.hasta) - inicioDiaLocal(v.desde) <= (MAX_DIAS - 1) * 86_400_000,
    { error: `El rango no puede superar ${MAX_DIAS} días`, path: ["hasta"] }
  );

// Por defecto, hoy: el informe se mira casi siempre al cerrar el día.
const resolverRango = (query) => {
  const desde = query.desde ?? hoyLocal();
  const hasta = query.hasta ?? desde;
  return { desde, hasta, ...rangoLocal(desde, hasta) };
};

const acumular = (mapa, clave, inicial) => {
  if (!mapa.has(clave)) mapa.set(clave, inicial());
  return mapa.get(clave);
};

// Solo cuentan las comandas CERRADAS, con el total congelado al cobrar.
const ventas = async (req, res) => {
  const { desde, hasta, inicio, fin } = resolverRango(req.valid.query);
  const comandas = await Comanda.find({ estado: "CERRADA", fecha_cierre: { $gte: inicio, $lt: fin } })
    .sort({ fecha_cierre: 1 })
    .lean();

  const porDia = new Map();
  const porMetodo = new Map();
  const porPlato = new Map();
  let total = 0;
  let platos = 0;
  let sinCaja = 0;

  for (const comanda of comandas) {
    const importe = Number(comanda.total ?? 0);
    total += importe;
    if (!comanda.arqueo_id) sinCaja += 1;

    const dia = acumular(porDia, diaLocal(comanda.fecha_cierre), () => ({ comandas: 0, total: 0 }));
    dia.comandas += 1;
    dia.total += importe;

    const metodo = acumular(porMetodo, comanda.metodo_pago ?? "SIN_REGISTRAR", () => ({ comandas: 0, total: 0 }));
    metodo.comandas += 1;
    metodo.total += importe;

    for (const item of comanda.items) {
      if (item.estado === "CANCELADO") continue; // no se cobró ni se vendió
      platos += item.cantidad;
      const plato = acumular(porPlato, item.nombre_item, () => ({ cantidad: 0, total: 0 }));
      plato.cantidad += item.cantidad;
      plato.total += Number(item.precio_unitario) * item.cantidad;
    }
  }

  const filas = (mapa, campo) => [...mapa.entries()].map(([k, v]) => ({ [campo]: k, ...v, total: redondear2(v.total) }));

  res.json({
    desde,
    hasta,
    resumen: {
      comandas: comandas.length,
      platos,
      total: redondear2(total),
      ticketPromedio: comandas.length ? Math.round(total / comandas.length) : 0,
      // Cobradas sin caja abierta: no entran en ningún arqueo.
      sinCaja,
    },
    porDia: filas(porDia, "fecha").sort((a, b) => a.fecha.localeCompare(b.fecha)),
    porMetodoPago: filas(porMetodo, "metodoPago").sort((a, b) => b.total - a.total),
    porPlato: filas(porPlato, "nombre").sort((a, b) => b.cantidad - a.cantidad),
  });
};

// Lo que se gastó de verdad, leído del libro de movimientos y no de las recetas.
const consumo = async (req, res) => {
  const { desde, hasta, inicio, fin } = resolverRango(req.valid.query);
  const movimientos = await MovimientoInventario.find({ fecha: { $gte: inicio, $lt: fin } })
    .populate("insumo_id", "nombre unidad stock stock_minimo")
    .sort({ fecha: 1, _id: 1 })
    .lean();

  const porInsumo = new Map();
  for (const mv of movimientos) {
    const insumo = mv.insumo_id;
    const fila = acumular(porInsumo, id(insumo), () => ({
      insumoId: id(insumo),
      nombre: insumo?.nombre ?? null,
      unidad: insumo?.unidad ?? null,
      stockActual: Number(insumo?.stock ?? 0),
      bajoMinimo: Number(insumo?.stock ?? 0) <= Number(insumo?.stock_minimo ?? 0),
      consumido: 0,
      devuelto: 0,
      comprado: 0,
      ajustado: 0,
      movimientos: 0,
    }));
    // Los consumos se guardan en negativo; el informe los muestra en positivo.
    const cantidad = Number(mv.cantidad);
    if (mv.tipo === "CONSUMO") fila.consumido += -cantidad;
    else if (mv.tipo === "DEVOLUCION") fila.devuelto += cantidad;
    else if (mv.tipo === "COMPRA") fila.comprado += cantidad;
    else fila.ajustado += cantidad;
    fila.movimientos += 1;
  }

  const insumos = [...porInsumo.values()]
    .map((f) => ({
      ...f,
      consumido: redondear3(f.consumido),
      devuelto: redondear3(f.devuelto),
      comprado: redondear3(f.comprado),
      ajustado: redondear3(f.ajustado),
      neto: redondear3(f.consumido - f.devuelto),
    }))
    .sort((a, b) => b.neto - a.neto || (a.nombre ?? "").localeCompare(b.nombre ?? ""));

  res.json({ desde, hasta, insumos });
};

module.exports = { rangoSchema, ventas, consumo };
