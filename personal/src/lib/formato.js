// Constantes y ayudas sin JSX: viven aparte de los componentes para que la
// recarga en caliente de React funcione bien.

// Cada rol entra directo a lo suyo. Toda ruta de aquí debe existir en App.jsx,
// o el comodín "*" devolvería al inicio y entraría en bucle.
export const INICIO_POR_ROL = {
  MESERO: "/mesas",
  COCINA: "/cocina",
  ADMIN: "/admin",
};

export const NOMBRE_ROL = { MESERO: "Mesero", COCINA: "Cocina", ADMIN: "Administración", USUARIO: "Cliente" };

export const ETIQUETA_ESTADO = {
  BORRADOR: "Sin enviar",
  PENDIENTE: "En cola",
  PREPARANDO: "Preparando",
  LISTO: "Listo",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

// El estado se pinta con relleno sólido, no con texto de color sobre fondo
// pálido: a dos metros un relleno se lee y un borde no.
export const COLOR_ESTADO = {
  BORRADOR: "bg-espera text-tinta-2",
  PENDIENTE: "bg-tinta text-white",
  PREPARANDO: "bg-tibio text-tinta",
  LISTO: "bg-listo text-white",
  ENTREGADO: "bg-espera text-tinta-2",
  CANCELADO: "bg-espera text-tinta-2 line-through",
};

export const ETIQUETA_PAGO = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  SIN_REGISTRAR: "Sin registrar",
};

export const UNIDADES = [
  { valor: "UND", texto: "Unidades" },
  { valor: "G", texto: "Gramos" },
  { valor: "ML", texto: "Mililitros" },
];

// --- Pedidos web, roles y auditoría (panel del admin) --------------------------
export const OPCIONES_ROL = [
  { valor: "ADMIN", texto: "Administración" },
  { valor: "MESERO", texto: "Mesero" },
  { valor: "COCINA", texto: "Cocina" },
  { valor: "USUARIO", texto: "Cliente" },
];
export const ROLES_NUEVA_CUENTA = OPCIONES_ROL.filter((r) => r.valor === "MESERO" || r.valor === "COCINA");

export const ETIQUETA_PEDIDO = {
  pendiente: "Por confirmar",
  confirmado: "Confirmado",
  preparando: "Preparando",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

// "Por confirmar" va en brasa: es lo único que pide que alguien actúe ya.
export const COLOR_PEDIDO = {
  pendiente: "bg-brasa text-white",
  confirmado: "bg-tinta text-white",
  preparando: "bg-tibio text-tinta",
  en_camino: "bg-listo text-white",
  entregado: "bg-espera text-tinta-2",
  cancelado: "bg-espera text-tinta-2 line-through",
};

// Qué dice el botón que lleva a cada estado.
export const ACCION_PEDIDO = {
  confirmado: "Confirmar",
  preparando: "Empezar a preparar",
  en_camino: "Despachar",
  entregado: "Marcar entregado",
  cancelado: "Cancelar",
};

// Orden en la lista de activos: primero lo que espera una acción.
export const ORDEN_PEDIDO = ["pendiente", "confirmado", "preparando", "en_camino", "entregado", "cancelado"];

export const ETIQUETA_SERVICIO = {
  menu: "Carta",
  pedidos: "Pedidos web",
  inventario: "Inventario",
  comandas: "Comandas",
  caja: "Caja",
  personal: "Personal",
  reservas: "Reservas",
  chatbot: "Chatbot",
};

// "2026-03-10T12:05:09.123" -> "2026-03-10 12:05"
export const fechaHora = (f) => (f ? f.replace("T", " ").slice(0, 16) : "");

// Código corto y legible de un id largo: #A1B2C3
export const codigoCorto = (id) => `#${String(id ?? "").slice(-6).toUpperCase()}`;

// Rango de los últimos N días (incluido hoy) en AAAA-MM-DD, hora local.
export function rangoDias(dias) {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - (dias - 1));
  return { desde: iso(desde), hasta: iso(hasta) };
}

export const pesos = (valor) => `$${Number(valor || 0).toLocaleString("es-CO")}`;

// Cantidades de inventario: hasta 3 decimales, pero sin ceros de adorno.
export const cantidad = (valor) => {
  const n = Number(valor || 0);
  return n.toLocaleString("es-CO", { maximumFractionDigits: 3 });
};

// Minutos transcurridos desde una marca de tiempo "naive" del servidor.
export const minutosDesde = (fecha) => {
  if (!fecha) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 60000));
};

// Fecha de hoy en AAAA-MM-DD, hora local, para los campos de rango.
export const hoyISO = () => {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, "0")}`;
};

// --- Escala de calor ---------------------------------------------------------
// Un único sitio decide cuánto lleva esperando algo. Los umbrales salen del
// servicio real: a los 8 minutos un plato empieza a pesar, a los 15 va tarde.
export const MINUTOS_TIBIO = 8;
export const MINUTOS_TARDE = 15;

export const nivelDeEspera = (minutos) => {
  if (minutos >= MINUTOS_TARDE) return "tarde";
  if (minutos >= MINUTOS_TIBIO) return "tibio";
  return "fresco";
};

// Cómo se pinta un ticket según lo que lleva esperando. El nivel "tarde" toma
// la pieza entera: desde la línea tiene que verse sin leer nada.
export const PIEL_ESPERA = {
  fresco: { pieza: "bg-mantel text-tinta", pestana: "bg-espera", reloj: "text-tinta-2" },
  tibio: { pieza: "bg-mantel text-tinta", pestana: "bg-tibio", reloj: "text-tibio" },
  tarde: { pieza: "bg-brasa text-white", pestana: "bg-white/35", reloj: "text-white" },
};

// --- Estado de una mesa ------------------------------------------------------
// Qué significa que una mesa esté "lista" lo decide un solo sitio, porque lo
// usan la rejilla del salón, la cuenta y el aviso del servidor.
export const EN_COCINA = ["PENDIENTE", "PREPARANDO"];

// Una mesa está COMPLETA cuando cocina no tiene nada suyo y hay platos
// esperando en el pase: el mesero puede llevárselo todo de una vez.
//
// Los borradores no la bloquean: son platos que el mesero todavía no ha
// mandado, así que por parte de la cocina el pedido sí está terminado.
export function resumenDeMesa(comanda) {
  if (!comanda) return { estado: "libre", listos: 0, enCocina: 0, total: 0 };

  const items = comanda.items ?? [];
  const enCocina = items.filter((i) => EN_COCINA.includes(i.estado)).length;
  const listos = items.filter((i) => i.estado === "LISTO").length;
  const total = items.filter((i) => i.estado !== "CANCELADO").length;

  const estado = listos > 0 && enCocina === 0 ? "completa" : listos > 0 ? "parcial" : "ocupada";
  return { estado, listos, enCocina, total };
}
