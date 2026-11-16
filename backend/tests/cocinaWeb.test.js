const { describe, test, before, after, beforeEach, afterEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect, crearPersonal } = require("./helpers");
const nodemailer = require("nodemailer");
const { Insumo, Order, MovimientoInventario, Factura, MenuItem } = require("../src/models");

let d;
let cocina;
let harina;

before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);
beforeEach(async () => {
  await limpiar();
  d = await datosBase();
  cocina = await crearPersonal("cocina");
  harina = (await api().post("/api/admin/insumos").set(admin())
    .send({ nombre: "Harina", unidad: "G", stock: 200, stockMinimo: 50 })).body;
  await api().put(`/api/admin/recetas/${d.huevos._id}`).set(admin())
    .send({ items: [{ insumoId: harina.id, cantidad: 80 }] });
});

const admin = () => bearer(d.tokenAdmin);
const cliente = () => bearer(d.tokenCliente);
const k = () => bearer(cocina.token);
const stock = async () => (await Insumo.findById(harina.id)).stock;
const cola = async () => (await api().get("/api/cocina/pendientes").set(k())).body;

// Pedido web del cliente: 2 huevos (con receta) y 1 café (sin receta).
const pedir = async () => {
  const res = await api().post("/api/pedidos").set(cliente()).send({
    items: [
      { menu_item_id: String(d.huevos._id), cantidad: 2 },
      { menu_item_id: String(d.cafe._id), cantidad: 1 },
    ],
    observaciones: "Sin sal",
  });
  return res.body;
};
const estado = (id, nuevo) => api().patch(`/api/pedidos/${id}/estado`).set(admin()).send({ estado: nuevo });
const marcar = (itemId, nuevo) => api().patch(`/api/cocina/items/${itemId}`).set(k()).send({ estado: nuevo });

describe("Pedidos web en cocina", () => {
  test("un pedido sin confirmar no llega a cocina ni toca el inventario", async () => {
    await pedir();
    expect(await cola()).toHaveLength(0);
    expect(await stock()).toBe(200);
  });

  test("al confirmarlo entra a cocina con su contenedor y descuenta la receta", async () => {
    const pedido = await pedir();
    const res = await estado(pedido.id, "confirmado");
    expect(res.status).toBe(200);

    const platos = await cola();
    expect(platos).toHaveLength(2);
    expect(platos.map((p) => p.nombre).sort()).toEqual(["Café", "Huevos"]);
    for (const plato of platos) {
      expect(plato.estado).toBe("PENDIENTE");
      expect(plato.pedidoId).toBe(pedido.id);
      expect(plato.comandaId).toBe(null);
      expect(plato.contenedor.tipo).toBe("domicilio");
      expect(plato.contenedor.titulo).toBe(`Domicilio #${pedido.id.slice(-6).toUpperCase()}`);
      expect(plato.notas).toBe("Sin sal");
    }

    // 2 huevos × 80 g de harina.
    expect(await stock()).toBe(40);
    const movs = await MovimientoInventario.find({ pedido_id: pedido.id });
    expect(movs).toHaveLength(1);
    expect(movs[0].tipo).toBe("CONSUMO");
    expect(movs[0].cantidad).toBe(-160);
    expect(movs[0].motivo).toBe(`Pedido web #${pedido.id.slice(-6).toUpperCase()}`);
  });

  test("aprobar el pago también lo manda a cocina, una sola vez", async () => {
    const pedido = await pedir();
    const { body: pago } = await api().post("/api/pagos").set(cliente()).send({ pedido_id: pedido.id, metodo: "efectivo" });
    const aprobado = await api().patch(`/api/pagos/${pago.id}/estado`).set(admin()).send({ estado: "aprobado" });
    expect(aprobado.status).toBe(200);

    expect((await Order.findById(pedido.id)).estado).toBe("confirmado");
    expect(await cola()).toHaveLength(2);
    expect(await stock()).toBe(40);
  });

  test("la cocina saca los platos: el pedido pasa a preparando y avisa cuando está completo", async () => {
    const pedido = await pedir();
    await estado(pedido.id, "confirmado");
    const [uno, dos] = await cola();

    const empezado = await marcar(uno.id, "PREPARANDO");
    expect(empezado.status).toBe(200);
    expect(empezado.body.estado).toBe("PREPARANDO");
    expect((await Order.findById(pedido.id)).estado).toBe("preparando");

    await marcar(uno.id, "LISTO");
    let lista = await api().get("/api/admin/pedidos?activos=true").set(admin());
    expect(lista.body[0].cocina).toEqual({ total: 2, listos: 1, completo: false });

    await marcar(dos.id, "LISTO");
    expect(await cola()).toHaveLength(0);
    lista = await api().get("/api/admin/pedidos?activos=true").set(admin());
    expect(lista.body[0].cocina).toEqual({ total: 2, listos: 2, completo: true });
    expect(lista.body[0].items.map((i) => i.estadoCocina)).toEqual(["LISTO", "LISTO"]);

    // Un plato listo no se puede volver a marcar.
    const otraVez = await marcar(dos.id, "LISTO");
    expect(otraVez.status).toBe(409);
    expect(otraVez.text).toBe("Ese plato ya está listo");
  });

  test("cancelar un pedido en cocina devuelve el inventario de lo que no salió", async () => {
    const pedido = await pedir();
    await estado(pedido.id, "confirmado");
    expect(await stock()).toBe(40);

    const cancelado = await api().patch(`/api/pedidos/${pedido.id}/cancelar`).set(cliente());
    expect(cancelado.status).toBe(200);
    expect(await cola()).toHaveLength(0);
    expect(await stock()).toBe(200);

    const guardado = await Order.findById(pedido.id).lean();
    expect(guardado.items.map((i) => i.estado_cocina)).toEqual(["CANCELADO", "CANCELADO"]);
  });

  test("lo que ya salió de cocina no se devuelve al cancelar", async () => {
    const pedido = await pedir();
    await estado(pedido.id, "confirmado");
    const huevos = (await cola()).find((p) => p.nombre === "Huevos");
    await marcar(huevos.id, "LISTO");

    // Ya está "preparando": solo el admin puede cancelarlo.
    const cancelado = await estado(pedido.id, "cancelado");
    expect(cancelado.status).toBe(200);
    expect(await stock()).toBe(40);
  });

  test("si el stock no alcanza no se bloquea: queda negativo y el plato lo dice", async () => {
    await api().post(`/api/admin/insumos/${harina.id}/ajuste`).set(admin()).send({ cantidad: -150, motivo: "Merma" });
    const pedido = await pedir();
    expect((await estado(pedido.id, "confirmado")).status).toBe(200);
    expect(await stock()).toBe(-110);
    const huevos = (await cola()).find((p) => p.nombre === "Huevos");
    expect(huevos.faltoStock).toBe(true);
  });

  test("la cola mezcla mesas y domicilios, cada uno con su contenedor", async () => {
    const mesero = await crearPersonal("mesero");
    const { body: mesa } = await api().post("/api/admin/mesas").set(admin()).send({ numero: 7 });
    const { body: comanda } = await api().post("/api/comandas").set(bearer(mesero.token)).send({ mesaId: mesa.id });
    await api().post(`/api/comandas/${comanda.id}/items`).set(bearer(mesero.token))
      .send({ menuItemId: String(d.cafe._id), cantidad: 1 });
    await api().post(`/api/comandas/${comanda.id}/enviar`).set(bearer(mesero.token));

    const pedido = await pedir();
    await estado(pedido.id, "confirmado");

    const platos = await cola();
    expect(platos).toHaveLength(3);
    const contenedores = [...new Set(platos.map((p) => p.contenedor.titulo))].sort();
    expect(contenedores).toEqual([`Domicilio #${pedido.id.slice(-6).toUpperCase()}`, "Mesa 7"]);
    expect(platos.find((p) => p.contenedor.tipo === "mesa").comandaId).toBe(comanda.id);
  });

  test("un pedido antiguo, sin id en sus platos, recibe ids al entrar a cocina", async () => {
    const pedido = await pedir();
    // Así quedaron guardados los pedidos anteriores a esta función.
    await Order.collection.updateOne(
      { _id: (await Order.findById(pedido.id))._id },
      { $unset: { "items.$[]._id": "", "items.$[].estado_cocina": "", enviado_cocina_en: "" } }
    );
    expect((await estado(pedido.id, "confirmado")).status).toBe(200);
    const platos = await cola();
    expect(platos).toHaveLength(2);
    expect(platos[0].id).toMatch(/^[a-f\d]{24}$/);
    expect((await marcar(platos[0].id, "LISTO")).status).toBe(200);
  });
});

describe("Comprobantes de pedidos web", () => {
  // Pedido pagado con el método indicado (pago aprobado) y llevado hasta entregado.
  const entregar = async (metodo) => {
    const pedido = await pedir();
    if (metodo) {
      const pago = await api().post("/api/pagos").set(cliente()).send({ pedido_id: pedido.id, metodo });
      // Aprobar el pago confirma el pedido.
      await api().patch(`/api/pagos/${pago.body.id}/estado`).set(admin()).send({ estado: "aprobado" });
    } else {
      await estado(pedido.id, "confirmado");
    }
    for (const paso of ["preparando", "en_camino", "entregado"]) {
      expect((await estado(pedido.id, paso)).status).toBe(200);
    }
    return pedido;
  };
  const facturas = async (query = "") => (await api().get(`/api/facturas${query}`).set(admin())).body;

  test("al entregar un pedido pagado por transferencia se emite su comprobante", async () => {
    const pedido = await entregar("transferencia");

    const lista = await facturas();
    expect(lista).toHaveLength(1);
    expect(lista[0].numero).toBe("BC-000001");
    expect(lista[0].pedidoId).toBe(pedido.id);
    expect(lista[0].total).toBe(45000);
    expect(lista[0].metodoPago).toBe("transferencia");
    expect(lista[0].cliente.correo).toBe(d.cliente.correo);
    // Sin clave de correo queda emitido y sin enviar, con el motivo a la vista.
    expect(lista[0].envio.estado).toBe("sin_enviar");
    expect(lista[0].envio.detalle).toMatch(/RESEND_API_KEY/);

    const doc = await Factura.findOne({ pedido_id: pedido.id });
    expect(doc.items.map((i) => [i.nombre, i.cantidad, i.subtotal])).toEqual([["Huevos", 2, 40000], ["Café", 1, 5000]]);
  });

  test("efectivo o sin pago no se factura solo: se genera desde el panel, una sola vez", async () => {
    const enEfectivo = await entregar("efectivo");
    const sinPago = await entregar(null);
    expect(await facturas()).toHaveLength(0);

    const pendientes = await api().get("/api/facturas/pendientes").set(admin());
    expect(pendientes.body.map((p) => p.pedidoId).sort()).toEqual([enEfectivo.id, sinPago.id].sort());

    const generada = await api().post("/api/facturas").set(admin()).send({ pedidoId: enEfectivo.id });
    expect(generada.status).toBe(201);
    expect(generada.body.numero).toBe("BC-000001");
    expect(generada.body.metodoPago).toBe("efectivo");

    // Otra vez el mismo pedido: responde el mismo comprobante, no uno nuevo.
    const repetida = await api().post("/api/facturas").set(admin()).send({ pedidoId: enEfectivo.id });
    expect(repetida.status).toBe(200);
    expect(repetida.body.id).toBe(generada.body.id);
    expect(await Factura.countDocuments()).toBe(1);

    const otra = await api().post("/api/facturas").set(admin()).send({ pedidoId: sinPago.id });
    expect(otra.body.numero).toBe("BC-000002");
    expect(otra.body.metodoPago).toBe(null);
    expect((await api().get("/api/facturas/pendientes").set(admin())).body).toHaveLength(0);
  });

  test("solo se factura lo entregado, y solo el admin entra al panel", async () => {
    const pedido = await pedir();
    const antes = await api().post("/api/facturas").set(admin()).send({ pedidoId: pedido.id });
    expect(antes.status).toBe(409);
    expect(antes.body.mensaje).toBe("El comprobante se genera cuando el pedido ya está entregado");

    expect((await api().get("/api/facturas").set(cliente())).status).toBe(403);
    expect((await api().get("/api/facturas")).status).toBe(401);
    expect((await api().post("/api/facturas").set(admin()).send({ pedidoId: "nada" })).status).toBe(400);
  });

  test("el PDF se descarga y el comprobante no cambia aunque cambie la carta", async () => {
    const pedido = await entregar("transferencia");
    const [factura] = await facturas();
    await MenuItem.updateMany({}, { precio: 1, nombre: "Otro nombre" });

    const pdf = await api().get(`/api/facturas/${factura.id}/pdf`).set(admin()).buffer(true).parse((res, fin) => {
      const trozos = [];
      res.on("data", (t) => trozos.push(t));
      res.on("end", () => fin(null, Buffer.concat(trozos)));
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect(pdf.headers["content-disposition"]).toBe('inline; filename="comprobante-BC-000001.pdf"');
    expect(pdf.body.subarray(0, 5).toString()).toBe("%PDF-");

    expect((await Factura.findOne({ pedido_id: pedido.id })).total).toBe(45000);
    expect((await api().get(`/api/facturas/${factura.id}/pdf`).set(cliente())).status).toBe(403);
  });

  describe("con el correo configurado", () => {
    const fetchReal = global.fetch;
    let enviados;
    let respuesta;

    beforeEach(() => {
      process.env.RESEND_API_KEY = "re_prueba";
      process.env.CORREO_REMITENTE = "Brunch <pedidos@e2e.brunch.test>";
      enviados = [];
      respuesta = { ok: true, status: 200, json: async () => ({ id: "correo-1" }) };
      // Nada sale a internet: se captura lo que se le mandaría a Resend.
      global.fetch = async (url, opciones) => {
        enviados.push({ url, cuerpo: JSON.parse(opciones.body), autorizacion: opciones.headers.Authorization });
        return respuesta;
      };
    });
    afterEach(() => {
      delete process.env.RESEND_API_KEY;
      delete process.env.CORREO_REMITENTE;
      global.fetch = fetchReal;
    });

    test("se envía al cliente con el PDF adjunto", async () => {
      await entregar("transferencia");

      expect(enviados).toHaveLength(1);
      expect(enviados[0].url).toBe("https://api.resend.com/emails");
      expect(enviados[0].autorizacion).toBe("Bearer re_prueba");
      expect(enviados[0].cuerpo.to).toEqual([d.cliente.correo]);
      expect(enviados[0].cuerpo.subject).toMatch(/BC-000001/);
      const [adjunto] = enviados[0].cuerpo.attachments;
      expect(adjunto.filename).toBe("comprobante-BC-000001.pdf");
      expect(Buffer.from(adjunto.content, "base64").subarray(0, 5).toString()).toBe("%PDF-");

      const [factura] = await facturas("?estado=enviada");
      expect(factura.envio.intentos).toBe(1);
    });

    test("si el correo falla, el pedido igual queda entregado y se puede reenviar", async () => {
      respuesta = { ok: false, status: 422, json: async () => ({ message: "Dominio sin verificar" }) };
      const pedido = await entregar("transferencia");
      expect((await Order.findById(pedido.id)).estado).toBe("entregado");

      const [factura] = await facturas("?estado=error");
      expect(factura.envio.detalle).toBe("Dominio sin verificar");

      respuesta = { ok: true, status: 200, json: async () => ({ id: "correo-2" }) };
      const reenviada = await api().post(`/api/facturas/${factura.id}/enviar`).set(admin());
      expect(reenviada.status).toBe(200);
      expect(reenviada.body.envio.estado).toBe("enviada");
      expect(reenviada.body.envio.intentos).toBe(2);
      expect(enviados).toHaveLength(2);
    });
  });

  describe("con Gmail configurado", () => {
    const crearReal = nodemailer.createTransport;
    const fetchReal = global.fetch;
    let conexiones;
    let correos;
    let fallo;

    beforeEach(() => {
      // Como la muestra Google: en grupos de cuatro, con espacios.
      process.env.GMAIL_USUARIO = "brunch@e2e.brunch.test";
      process.env.GMAIL_CLAVE_APP = "abcd efgh ijkl mnop";
      conexiones = [];
      correos = [];
      fallo = null;
      // Nada sale a internet: se captura lo que se le entregaría a Gmail.
      nodemailer.createTransport = (opciones) => {
        conexiones.push(opciones);
        return {
          sendMail: async (correo) => {
            if (fallo) throw fallo;
            correos.push(correo);
            return { messageId: "<prueba>" };
          },
          close: () => {},
        };
      };
    });
    afterEach(() => {
      delete process.env.GMAIL_USUARIO;
      delete process.env.GMAIL_CLAVE_APP;
      delete process.env.RESEND_API_KEY;
      delete process.env.CORREO_REMITENTE;
      nodemailer.createTransport = crearReal;
      global.fetch = fetchReal;
    });

    test("sale por Gmail con el PDF adjunto, aunque Resend también esté configurado", async () => {
      process.env.RESEND_API_KEY = "re_prueba";
      process.env.CORREO_REMITENTE = "Brunch <pedidos@e2e.brunch.test>";
      let porResend = 0;
      global.fetch = async () => {
        porResend += 1;
        return { ok: true, status: 200, json: async () => ({}) };
      };

      await entregar("transferencia");

      expect(porResend).toBe(0);
      expect(conexiones[0].service).toBe("gmail");
      expect(conexiones[0].auth).toEqual({ user: "brunch@e2e.brunch.test", pass: "abcdefghijklmnop" });
      expect(correos).toHaveLength(1);
      expect(correos[0].from).toEqual({ name: "Brunch & Co.", address: "brunch@e2e.brunch.test" });
      expect(correos[0].to).toBe(d.cliente.correo);
      expect(correos[0].subject).toMatch(/BC-000001/);
      const [adjunto] = correos[0].attachments;
      expect(adjunto.filename).toBe("comprobante-BC-000001.pdf");
      expect(adjunto.content.subarray(0, 5).toString()).toBe("%PDF-");

      const [factura] = await facturas("?estado=enviada");
      expect(factura.envio.intentos).toBe(1);
    });

    test("si Gmail rechaza la contraseña, el pedido queda entregado y el motivo se ve", async () => {
      fallo = Object.assign(new Error("Invalid login: 535-5.7.8 Username and Password not accepted"), { code: "EAUTH" });
      const pedido = await entregar("transferencia");
      expect((await Order.findById(pedido.id)).estado).toBe("entregado");

      const [factura] = await facturas("?estado=error");
      expect(factura.envio.detalle).toBe("Gmail rechazó el usuario o la contraseña de aplicación");

      fallo = null;
      const reenviada = await api().post(`/api/facturas/${factura.id}/enviar`).set(admin());
      expect(reenviada.body.envio.estado).toBe("enviada");
      expect(correos).toHaveLength(1);
    });
  });
});
