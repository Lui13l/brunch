// Contrato JSON de la app de comandas (personal): camelCase, ids como texto,
// dinero y stock como números, fechas en hora local del restaurante sin Z.
// Las rutas de la web siguen usando el toJSON de Mongoose (snake_case).
const { rolPublico } = require("./roles");
const { fechaLocal } = require("./tiempo");
const { redondear2 } = require("./dinero");

const id = (v) => (v == null ? null : String(v._id ?? v));
const num = (v) => (v == null ? null : Number(v));
const o = (v) => (v === undefined || v === "" ? null : v);

const toUsuarioPersonal = (u) => ({
  id: id(u),
  nombre: u.nombre,
  email: u.correo,
  rol: rolPublico(u.rol_id),
  activo: u.activo !== false,
  celular: o(u.celular),
  fechaCreacion: fechaLocal(u.createdAt),
  dosFaActivo: false,
  cuentaGoogle: false,
});

const toPlato = (m) => ({
  id: id(m),
  nombre: m.nombre,
  descripcion: o(m.descripcion),
  precio: num(m.precio),
  imagenUrl: o(m.img_url),
  disponible: m.activo !== false,
  visibleWeb: m.visible_web !== false,
  visibleSalon: m.visible_salon !== false,
  categoriaId: id(m.categoria_id),
  tipo: m.tipo,
  orden: m.orden ?? 0,
});

const toCategoriaSalon = (c, items) => ({
  id: id(c),
  nombre: c.nombre,
  items: items.map(toPlato),
});

const toMesa = (m, comandaAbiertaId = null) => ({
  id: id(m),
  numero: m.numero,
  nombre: o(m.nombre),
  capacidad: m.capacidad ?? 4,
  activa: m.activa !== false,
  comandaAbiertaId: comandaAbiertaId ? String(comandaAbiertaId) : null,
});

const toAuditLog = (a) => ({
  id: id(a),
  accion: a.accion,
  detalle: a.detalle,
  servicio: a.servicio,
  fecha: fechaLocal(a.fecha),
  usuario: a.usuario_id
    ? { id: id(a.usuario_id), nombre: a.usuario_nombre, rol: rolPublico(a.usuario_rol) }
    : null,
});

const toInsumo = (i) => ({
  id: id(i),
  nombre: i.nombre,
  unidad: i.unidad,
  stock: num(i.stock) ?? 0,
  stockMinimo: num(i.stock_minimo) ?? 0,
  activo: i.activo !== false,
  // Se calcula aquí para que todas las pantallas coincidan en qué es "bajo".
  bajoMinimo: Number(i.stock ?? 0) <= Number(i.stock_minimo ?? 0),
});

// r.insumo_id viene poblado con { nombre, unidad }.
const toRecetaItem = (r) => ({
  insumoId: id(r.insumo_id),
  nombre: r.insumo_id?.nombre ?? null,
  unidad: r.insumo_id?.unidad ?? null,
  cantidad: num(r.cantidad),
});

const toMovimiento = (m, insumo) => ({
  id: id(m),
  insumoId: id(m.insumo_id),
  insumo: insumo?.nombre ?? null,
  tipo: m.tipo,
  cantidad: num(m.cantidad),
  stockResultante: num(m.stock_resultante),
  motivo: o(m.motivo),
  comandaId: id(m.comanda_id),
  comandaItemId: id(m.comanda_item_id),
  usuarioId: id(m.usuario_id),
  fecha: fechaLocal(m.fecha),
});

const toComandaItem = (i) => ({
  id: id(i),
  menuItemId: id(i.menu_item_id),
  nombre: i.nombre_item,
  precioUnitario: num(i.precio_unitario),
  cantidad: i.cantidad,
  subtotal: redondear2(Number(i.precio_unitario) * i.cantidad),
  notas: o(i.notas),
  estado: i.estado,
  faltoStock: Boolean(i.falto_stock),
  fechaCreacion: fechaLocal(i.fecha_creacion),
  fechaEnvio: fechaLocal(i.fecha_envio),
  fechaListo: fechaLocal(i.fecha_listo),
});

const totalDeItems = (items) =>
  redondear2(items.filter((i) => i.estado !== "CANCELADO").reduce((suma, i) => suma + i.subtotal, 0));

// c.mesa_id puede venir poblado con { numero }.
const toComanda = (c) => {
  const items = (c.items ?? []).map(toComandaItem);
  return {
    id: id(c),
    mesaId: id(c.mesa_id),
    mesaNumero: c.mesa_id?.numero ?? null,
    meseroId: id(c.mesero_id),
    estado: c.estado,
    comensales: c.comensales ?? null,
    notas: o(c.notas),
    // Mientras está abierta el total se calcula al vuelo; al cerrar se congela.
    total: c.total != null ? num(c.total) : totalDeItems(items),
    metodoPago: c.metodo_pago ?? null,
    tieneFaltante: Boolean(c.tiene_faltante),
    fechaApertura: fechaLocal(c.fecha_apertura),
    fechaCierre: fechaLocal(c.fecha_cierre),
    items,
  };
};

// u puede venir poblado ({ _id, nombre }) o ser solo el ObjectId.
const usuarioCorto = (u) => (u ? { id: id(u), nombre: u.nombre ?? null } : null);

const toMovimientoCaja = (m, arqueoId) => ({
  id: id(m),
  arqueoId: id(arqueoId),
  tipo: m.tipo,
  concepto: m.concepto,
  monto: num(m.monto),
  usuarioId: id(m.usuario_id),
  anulado: Boolean(m.anulado),
  fecha: fechaLocal(m.fecha),
});

// El cuadre (esperado, contado, diferencia) va aparte: lo calcula services/caja.js.
const toArqueo = (a) => ({
  id: id(a),
  estado: a.estado,
  baseInicial: num(a.base_inicial),
  abiertoPor: usuarioCorto(a.abierto_por),
  cerradoPor: usuarioCorto(a.cerrado_por),
  notasApertura: o(a.notas_apertura),
  notasCierre: o(a.notas_cierre),
  fechaApertura: fechaLocal(a.fecha_apertura),
  fechaCierre: fechaLocal(a.fecha_cierre),
  movimientos: [...(a.movimientos ?? [])].reverse().map((m) => toMovimientoCaja(m, a._id)),
});

// Pedido web para la pantalla del admin. p.usuario_id puede venir poblado;
// si no, se usa el cliente que se pasa aparte.
const toPedidoAdmin = (p, transiciones, cliente) => {
  const c = p.usuario_id?.nombre !== undefined ? p.usuario_id : cliente;
  const dom = p.domiciliario_id?.nombre !== undefined ? p.domiciliario_id : null;
  return {
    id: id(p),
    estado: p.estado,
    siguientes: transiciones[p.estado] ?? [],
    total: num(p.total),
    items: (p.items ?? []).map((i) => ({
      menuItemId: id(i.menu_item_id),
      nombre: i.nombre,
      cantidad: i.cantidad,
      precioUnitario: num(i.precio_unitario),
      subtotal: num(i.subtotal),
    })),
    direccion: o(p.direccion_pedido),
    observaciones: o(p.observaciones),
    fechaInicio: fechaLocal(p.fecha_inicio ?? p.createdAt),
    fechaProgramada: fechaLocal(p.fecha_programada),
    cliente: c ? { id: id(c), nombre: c.nombre, correo: c.correo ?? null, celular: o(c.celular) } : null,
    domiciliario: dom ? { id: id(dom), nombre: [dom.nombre, dom.apellido].filter(Boolean).join(" "), telefono: o(dom.telefono) } : null,
    pagoId: id(p.pago_id),
  };
};

module.exports = {
  toPedidoAdmin,
  toArqueo,
  toMovimientoCaja,
  toComandaItem,
  totalDeItems,
  toComanda,
  id,
  num,
  o,
  redondear2,
  toUsuarioPersonal,
  toPlato,
  toCategoriaSalon,
  toMesa,
  toAuditLog,
  toInsumo,
  toRecetaItem,
  toMovimiento,
};
