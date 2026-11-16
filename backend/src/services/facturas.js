const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const { Factura, Order, Payment, User } = require("../models");
const { HttpError } = require("../utils/http");
const { pesos } = require("../utils/dinero");
const { fechaLocal } = require("../utils/tiempo");
const { codigoCorto } = require("../utils/codigo");

// Comprobantes en PDF de los pedidos web y su envío por correo (Gmail o Resend).
// Es un comprobante del pedido, no una factura electrónica ante la DIAN.

const NEGOCIO = "Brunch & Co.";
const METODO = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };

// "BC-000012"
const numeroLegible = (numero) => `BC-${String(numero).padStart(6, "0")}`;
const nombreArchivo = (factura) => `comprobante-${numeroLegible(factura.numero)}.pdf`;
// "2026-03-10T12:05:09.123" -> "2026-03-10 12:05", en la hora del restaurante.
const fechaLegible = (fecha) => (fecha ? fechaLocal(fecha).replace("T", " ").slice(0, 16) : "");

const siguienteNumero = async () => {
  const contador = await Factura.Contador.findOneAndUpdate(
    { _id: "factura" },
    { $inc: { valor: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return contador.valor;
};

/**
 * Emite el comprobante de un pedido entregado. Si ya tiene uno, devuelve ese:
 * un pedido nunca tiene dos.
 *
 * Copia del pedido lo que se cobró y del cliente a quién, para que el PDF no
 * cambie si después se edita la carta o el perfil.
 */
const emitir = async (pedidoId) => {
  const existente = await Factura.findOne({ pedido_id: pedidoId });
  if (existente) return existente;

  const pedido = await Order.findById(pedidoId).lean();
  if (!pedido) throw new HttpError(404, "Pedido no encontrado");
  if (pedido.estado !== "entregado") {
    throw new HttpError(409, "El comprobante se genera cuando el pedido ya está entregado");
  }
  const [cliente, pago] = await Promise.all([
    User.findById(pedido.usuario_id).select("nombre correo direccion celular").lean(),
    Payment.findOne({ pedido_id: pedido._id, estado: "aprobado" }).lean(),
  ]);

  try {
    return await Factura.create({
      numero: await siguienteNumero(),
      pedido_id: pedido._id,
      usuario_id: pedido.usuario_id,
      cliente: {
        nombre: cliente?.nombre ?? "",
        correo: cliente?.correo ?? "",
        direccion: pedido.direccion_pedido || cliente?.direccion || "",
        celular: cliente?.celular ?? "",
      },
      items: pedido.items.map((i) => ({
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
      total: pedido.total,
      metodo_pago: pago?.metodo ?? null,
      fecha_pedido: pedido.fecha_inicio ?? pedido.createdAt ?? null,
    });
  } catch (error) {
    // Dos peticiones a la vez: gana una y la otra devuelve el mismo comprobante.
    // (El consecutivo que tomó la que perdió queda sin usar.)
    if (error.code === 11000) {
      const ganadora = await Factura.findOne({ pedido_id: pedidoId });
      if (ganadora) return ganadora;
    }
    throw error;
  }
};

// Arma el PDF con lo guardado en el comprobante. Devuelve un Buffer.
const generarPdf = (factura) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: `Comprobante ${numeroLegible(factura.numero)}` } });
    const trozos = [];
    doc.on("data", (trozo) => trozos.push(trozo));
    doc.on("end", () => resolve(Buffer.concat(trozos)));
    doc.on("error", reject);

    const TINTA = "#391903";
    const SUAVE = "#7a6656";
    const LINEA = "#d9c9bb";
    const izquierda = doc.page.margins.left;
    const derecha = doc.page.width - doc.page.margins.right;
    const ancho = derecha - izquierda;
    // Columnas de la tabla: plato, cantidad, precio y subtotal.
    const col = { cantidad: izquierda + ancho * 0.52, precio: izquierda + ancho * 0.64, subtotal: izquierda + ancho * 0.82 };
    const filete = (y) => doc.moveTo(izquierda, y).lineTo(derecha, y).lineWidth(0.7).strokeColor(LINEA).stroke();

    doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(24).text(NEGOCIO, izquierda, 56);
    doc.font("Helvetica").fontSize(10).fillColor(SUAVE).text("Neiva, Huila", izquierda, 86);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(TINTA).text("Comprobante de pedido", izquierda, 56, { width: ancho, align: "right" });
    doc.font("Helvetica").fontSize(11).text(numeroLegible(factura.numero), izquierda, 72, { width: ancho, align: "right" });
    doc.fontSize(10).fillColor(SUAVE).text(`Emitido el ${fechaLegible(factura.fecha_emision)}`, izquierda, 88, { width: ancho, align: "right" });
    filete(112);

    const dato = (etiqueta, valor, x, y, anchoDato) => {
      doc.font("Helvetica").fontSize(9).fillColor(SUAVE).text(etiqueta, x, y, { width: anchoDato });
      doc.font("Helvetica").fontSize(11).fillColor(TINTA).text(valor || "—", x, y + 12, { width: anchoDato });
    };
    const mitad = ancho / 2 - 12;
    dato("Cliente", factura.cliente.nombre, izquierda, 126, mitad);
    dato("Correo", factura.cliente.correo, izquierda, 160, mitad);
    dato("Celular", factura.cliente.celular, izquierda, 194, mitad);
    dato("Pedido", `${codigoCorto(factura.pedido_id)} · ${fechaLegible(factura.fecha_pedido)}`, izquierda + ancho / 2, 126, mitad);
    dato("Forma de pago", METODO[factura.metodo_pago] ?? "Sin registrar", izquierda + ancho / 2, 160, mitad);
    dato("Dirección de entrega", factura.cliente.direccion, izquierda + ancho / 2, 194, mitad);

    let y = 250;
    const encabezado = () => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(SUAVE);
      doc.text("Plato", izquierda, y);
      doc.text("Cant.", col.cantidad, y, { width: col.precio - col.cantidad - 8, align: "right" });
      doc.text("Precio", col.precio, y, { width: col.subtotal - col.precio - 8, align: "right" });
      doc.text("Subtotal", col.subtotal, y, { width: derecha - col.subtotal, align: "right" });
      y += 16;
      filete(y - 4);
    };
    encabezado();

    doc.font("Helvetica").fontSize(11).fillColor(TINTA);
    for (const item of factura.items) {
      const anchoNombre = col.cantidad - izquierda - 12;
      const alto = Math.max(doc.heightOfString(item.nombre, { width: anchoNombre }), 13) + 9;
      // Un pedido largo sigue en otra página, con su encabezado.
      if (y + alto > doc.page.height - doc.page.margins.bottom - 90) {
        doc.addPage();
        y = doc.page.margins.top;
        encabezado();
        doc.font("Helvetica").fontSize(11).fillColor(TINTA);
      }
      doc.text(item.nombre, izquierda, y, { width: anchoNombre });
      doc.text(String(item.cantidad), col.cantidad, y, { width: col.precio - col.cantidad - 8, align: "right" });
      doc.text(pesos(item.precio_unitario), col.precio, y, { width: col.subtotal - col.precio - 8, align: "right" });
      doc.text(pesos(item.subtotal), col.subtotal, y, { width: derecha - col.subtotal, align: "right" });
      y += alto;
      filete(y - 5);
    }

    y += 8;
    doc.font("Helvetica-Bold").fontSize(14).fillColor(TINTA);
    doc.text("Total", col.precio, y, { width: col.subtotal - col.precio - 8, align: "right" });
    doc.text(pesos(factura.total), col.subtotal, y, { width: derecha - col.subtotal, align: "right" });

    doc.font("Helvetica").fontSize(9).fillColor(SUAVE).text(
      "Gracias por pedir en Brunch & Co. Este documento es un comprobante de tu pedido; no es una factura electrónica.",
      izquierda,
      y + 44,
      { width: ancho }
    );
    doc.end();
  });

const escapar = (texto) =>
  String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const cuerpoDelCorreo = (factura) => `
  <div style="font-family: Arial, Helvetica, sans-serif; color: #391903; max-width: 520px;">
    <h1 style="font-size: 22px; margin: 0 0 12px;">${NEGOCIO}</h1>
    <p>Hola, ${escapar(factura.cliente.nombre) || "¿cómo estás?"}:</p>
    <p>Tu pedido ${codigoCorto(factura.pedido_id)} ya fue entregado. Te dejamos adjunto el comprobante
      <strong>${numeroLegible(factura.numero)}</strong> por <strong>${pesos(factura.total)}</strong>.</p>
    <p>Gracias por pedir con nosotros. ¡Que lo disfrutes!</p>
    <p style="color: #7a6656; font-size: 12px;">Este comprobante no es una factura electrónica.</p>
  </div>`;

const guardarEnvio = (factura, estado, detalle) =>
  Factura.findByIdAndUpdate(
    factura._id,
    { $set: { "envio.estado": estado, "envio.detalle": detalle, "envio.fecha": new Date() }, $inc: { "envio.intentos": 1 } },
    { returnDocument: "after" }
  );

// --- Por dónde sale el correo ---
// Cada salida recibe { para, asunto, html, adjunto } y lanza un Error con un
// mensaje que se pueda mostrar en el panel si el correo no sale.

// Gmail por SMTP, con una "contraseña de aplicación" de la cuenta. No necesita
// dominio propio y le llega a cualquier destinatario (unos 500 correos al día).
const porGmail = ({ usuario, clave }) => async ({ para, asunto, html, adjunto }) => {
  const transporte = nodemailer.createTransport({
    service: "gmail",
    auth: { user: usuario, pass: clave },
    // Marcar un pedido como entregado no puede quedarse esperando al correo.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    await transporte.sendMail({
      from: { name: NEGOCIO, address: usuario },
      to: para,
      subject: asunto,
      html,
      attachments: [{ filename: adjunto.nombre, content: adjunto.contenido, contentType: "application/pdf" }],
    });
  } catch (error) {
    if (error.code === "EAUTH") throw new Error("Gmail rechazó el usuario o la contraseña de aplicación");
    if (["ETIMEDOUT", "ESOCKET", "ECONNECTION"].includes(error.code)) throw new Error("No se pudo conectar con Gmail");
    throw error;
  } finally {
    transporte.close();
  }
};

// La API de Resend. Solo entrega a cualquier destinatario si el remitente es
// de un dominio verificado en la cuenta.
const porResend = ({ clave, remitente }) => async ({ para, asunto, html, adjunto }) => {
  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remitente,
        to: [para],
        subject: asunto,
        html,
        attachments: [{ filename: adjunto.nombre, content: adjunto.contenido.toString("base64") }],
      }),
      // Marcar un pedido como entregado no puede quedarse esperando al correo.
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Error(error.name === "TimeoutError" ? "El servicio de correo tardó demasiado" : error.message);
  }
  if (res.ok) return;
  const respuesta = await res.json().catch(() => null);
  throw new Error(respuesta?.message || `El servicio de correo respondió ${res.status}`);
};

const SIN_CORREO = "El correo no está configurado (GMAIL_USUARIO y GMAIL_CLAVE_APP, o RESEND_API_KEY y CORREO_REMITENTE)";

// La salida configurada en .env, o null si no hay ninguna. Si están las dos,
// manda Gmail: es la que funciona sin dominio. Para volver a Resend basta con
// quitar las variables de Gmail.
const salidaDeCorreo = () => {
  const usuario = process.env.GMAIL_USUARIO?.trim();
  // Google muestra la contraseña de aplicación en grupos de cuatro, con espacios.
  const claveGmail = process.env.GMAIL_CLAVE_APP?.replace(/\s+/g, "");
  if (usuario && claveGmail) return porGmail({ usuario, clave: claveGmail });

  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.CORREO_REMITENTE;
  if (clave && remitente) return porResend({ clave, remitente });
  return null;
};

/**
 * Envía el comprobante al correo del cliente, por Gmail o por Resend.
 *
 * Nunca lanza: lo que pase queda anotado en `envio` y el comprobante sigue
 * existiendo. Sin correo configurado queda "sin enviar", y se puede reenviar
 * desde el panel cuando lo esté.
 */
const enviar = async (factura) => {
  const mandar = salidaDeCorreo();
  if (!mandar) return guardarEnvio(factura, "sin_enviar", SIN_CORREO);
  if (!factura.cliente.correo) return guardarEnvio(factura, "error", "El cliente no tiene correo");

  try {
    await mandar({
      para: factura.cliente.correo,
      asunto: `Tu comprobante ${numeroLegible(factura.numero)} de ${NEGOCIO}`,
      html: cuerpoDelCorreo(factura),
      adjunto: { nombre: nombreArchivo(factura), contenido: await generarPdf(factura) },
    });
    return await guardarEnvio(factura, "enviada", null);
  } catch (error) {
    return guardarEnvio(factura, "error", String(error.message).slice(0, 300)).catch(() => factura);
  }
};

/**
 * Al entregarse un pedido pagado por transferencia (con el pago aprobado), se
 * emite su comprobante y se envía. Los demás se generan a mano desde el panel.
 *
 * Nunca lanza: el pedido ya quedó entregado y eso no se deshace por un correo.
 */
const facturarAlEntregar = async (pedido) => {
  try {
    const pagado = await Payment.exists({ pedido_id: pedido._id, estado: "aprobado", metodo: "transferencia" });
    if (!pagado) return null;
    return await enviar(await emitir(pedido._id));
  } catch (error) {
    console.error(`No se pudo facturar el pedido ${codigoCorto(pedido._id)}:`, error.message);
    return null;
  }
};

module.exports = { numeroLegible, nombreArchivo, emitir, generarPdf, enviar, facturarAlEntregar };
