const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect, crearPersonal } = require("./helpers");
const { Comanda } = require("../src/models");

let d;
let mesero;
let mesa;

before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);
beforeEach(async () => {
  await limpiar();
  d = await datosBase();
  mesero = await crearPersonal("mesero");
  mesa = (await api().post("/api/admin/mesas").set(admin()).send({ numero: 1 })).body;
});

const admin = () => bearer(d.tokenAdmin);
const abrirCaja = (baseInicial = 50000) =>
  api().post("/api/admin/caja/abrir").set(admin()).send({ baseInicial, notas: null });

// Cobra una cuenta de `cantidad` cafés (5000 c/u) con el método indicado, o
// dividida en `pagos`.
const cobrar = async (metodoPago, cantidad = 1, pagos = null) => {
  const m = bearer(mesero.token);
  const { body: c } = await api().post("/api/comandas").set(m).send({ mesaId: mesa.id });
  await api().post(`/api/comandas/${c.id}/items`).set(m).send({ menuItemId: String(d.cafe._id), cantidad });
  const { body: enviado } = await api().post(`/api/comandas/${c.id}/enviar`).set(m);
  // La cocina saca los platos (un cierre forzado los cancelaría y no se cobrarían).
  for (const item of enviado.comanda.items) {
    await api().patch(`/api/cocina/items/${item.id}`).set(admin()).send({ estado: "LISTO" });
  }
  return api().post(`/api/comandas/${c.id}/cerrar`).set(admin()).send(pagos ? { pagos } : { metodoPago });
};

describe("Caja", () => {
  test("sin caja abierta responde abierta:false", async () => {
    const res = await api().get("/api/admin/caja").set(admin());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ abierta: false, arqueo: null, cuadre: null });
  });

  test("abrir devuelve el estado completo y solo puede haber una abierta", async () => {
    const res = await abrirCaja();
    expect(res.status).toBe(200);
    expect(res.body.abierta).toBe(true);
    expect(res.body.arqueo.id).toMatch(/^[a-f\d]{24}$/);
    expect(res.body.arqueo.abiertoPor.nombre).toBe("Admin");
    expect(res.body.cuadre.esperado.EFECTIVO).toBe(50000);

    const otra = await abrirCaja();
    expect(otra.status).toBe(409);
    expect(otra.text).toBe("Ya hay una caja abierta");

    const simultaneas = await (async () => {
      await api().post("/api/admin/caja/cerrar").set(admin())
        .send({ contadoEfectivo: 50000, contadoTarjeta: 0, contadoTransferencia: 0 });
      return Promise.all([abrirCaja(), abrirCaja()]);
    })();
    expect(simultaneas.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  test("el cuadre suma base, ventas en efectivo y movimientos no anulados", async () => {
    await abrirCaja(50000);
    await cobrar("EFECTIVO", 2); // 10000
    await cobrar("TARJETA", 1); // 5000

    const ingreso = await api().post("/api/admin/caja/movimientos").set(admin())
      .send({ tipo: "INGRESO", concepto: "Cambio", monto: 10000 });
    expect(ingreso.status).toBe(200);
    const egreso = await api().post("/api/admin/caja/movimientos").set(admin())
      .send({ tipo: "EGRESO", concepto: "Hielo", monto: 3000 });
    const egresoId = egreso.body.arqueo.movimientos.find((x) => x.tipo === "EGRESO").id;

    const anulado = await api().delete(`/api/admin/caja/movimientos/${egresoId}`).set(admin());
    expect(anulado.status).toBe(200);
    expect(anulado.body.abierta).toBe(true);

    const otraVez = await api().delete(`/api/admin/caja/movimientos/${egresoId}`).set(admin());
    expect(otraVez.status).toBe(409);

    const { cuadre } = anulado.body;
    expect(cuadre.ventas.EFECTIVO).toBe(10000);
    expect(cuadre.ventas.TARJETA).toBe(5000);
    expect(cuadre.comandas).toBe(2);
    expect(cuadre.ingresos).toBe(10000);
    expect(cuadre.egresos).toBe(0);
    expect(cuadre.esperado).toEqual({ EFECTIVO: 70000, TARJETA: 5000, TRANSFERENCIA: 0 });
  });

  test("cada movimiento lleva su método y solo el efectivo toca el cajón", async () => {
    await abrirCaja(50000);
    await cobrar("TRANSFERENCIA", 1); // 5000
    const mov = (tipo, monto, metodo) =>
      api().post("/api/admin/caja/movimientos").set(admin())
        .send({ tipo, concepto: "Prueba", monto, ...(metodo ? { metodo } : {}) });

    // Un monto cualquiera (antes la pantalla solo aceptaba los terminados en 1).
    const abono = await mov("INGRESO", 25000, "TRANSFERENCIA");
    expect(abono.status).toBe(200);
    expect(abono.body.arqueo.movimientos[0].metodo).toBe("TRANSFERENCIA");
    await mov("EGRESO", 2000, "TARJETA");
    // Sin método cuenta como efectivo, igual que los movimientos antiguos.
    const { body } = await mov("EGRESO", 3500);
    expect(body.arqueo.movimientos[0].metodo).toBe("EFECTIVO");

    expect(body.cuadre.movimientos).toEqual({
      EFECTIVO: { ingresos: 0, egresos: 3500 },
      TARJETA: { ingresos: 0, egresos: 2000 },
      TRANSFERENCIA: { ingresos: 25000, egresos: 0 },
    });
    expect(body.cuadre.ingresos).toBe(25000);
    expect(body.cuadre.egresos).toBe(5500);
    expect(body.cuadre.esperado).toEqual({ EFECTIVO: 46500, TARJETA: -2000, TRANSFERENCIA: 30000 });

    const malo = await mov("INGRESO", 1000, "CHEQUE");
    expect(malo.status).toBe(400);
    expect(malo.text).toBe("El método debe ser EFECTIVO, TARJETA o TRANSFERENCIA");
  });

  test("cerrar congela lo esperado; recalculado delata cambios posteriores", async () => {
    await abrirCaja(50000);
    await cobrar("EFECTIVO", 1);

    const cerrado = await api().post("/api/admin/caja/cerrar").set(admin())
      .send({ contadoEfectivo: 54000, contadoTarjeta: 0, contadoTransferencia: 0, notas: "faltó" });
    expect(cerrado.status).toBe(200);
    expect(cerrado.body.abierta).toBe(false);
    expect(cerrado.body.cuadre.esperado.EFECTIVO).toBe(55000);
    expect(cerrado.body.cuadre.diferencia.EFECTIVO).toBe(-1000);

    // Alguien toca una comanda cobrada después del cierre.
    await Comanda.updateMany({ estado: "CERRADA" }, { total: 9000 });
    const detalle = await api().get(`/api/admin/caja/${cerrado.body.arqueo.id}`).set(admin());
    expect(detalle.body.cuadre.esperado.EFECTIVO).toBe(55000);
    expect(detalle.body.cuadre.recalculado.EFECTIVO).toBe(59000);

    const historial = await api().get("/api/admin/caja/historial").set(admin());
    expect(historial.body).toHaveLength(1);
  });

  test("sin caja abierta no se registran movimientos ni se cierra", async () => {
    const mov = await api().post("/api/admin/caja/movimientos").set(admin())
      .send({ tipo: "INGRESO", concepto: "x", monto: 1 });
    expect(mov.status).toBe(409);
    expect(mov.text).toBe("No hay ninguna caja abierta. Ábrela antes de registrar movimientos.");

    const sinConcepto = await abrirCaja().then(() =>
      api().post("/api/admin/caja/movimientos").set(admin()).send({ tipo: "INGRESO", concepto: "", monto: 1 }));
    expect(sinConcepto.status).toBe(400);
    expect(sinConcepto.text).toBe("El concepto es obligatorio");
  });

  test("una cuenta dividida reparte su total entre los métodos de cada parte", async () => {
    await abrirCaja(50000);
    const res = await cobrar(null, 4, [
      { metodo: "EFECTIVO", monto: 5000, etiqueta: "Parte 1 de 3" },
      { metodo: "EFECTIVO", monto: 5000, etiqueta: "Parte 2 de 3" },
      { metodo: "TRANSFERENCIA", monto: 10000, etiqueta: "Parte 3 de 3" },
    ]);
    expect(res.status).toBe(200);

    const { body } = await api().get("/api/admin/caja").set(admin());
    expect(body.cuadre.ventas).toEqual({ EFECTIVO: 10000, TARJETA: 0, TRANSFERENCIA: 10000, SIN_REGISTRAR: 0 });
    expect(body.cuadre.comandas).toBe(1);
    expect(body.cuadre.esperado).toEqual({ EFECTIVO: 60000, TARJETA: 0, TRANSFERENCIA: 10000 });

    // Alguien cambia el total después de cobrar: lo que no cuadra se ve aparte.
    await Comanda.updateMany({ estado: "CERRADA" }, { total: 23000 });
    const tocada = await api().get("/api/admin/caja").set(admin());
    expect(tocada.body.cuadre.ventas.SIN_REGISTRAR).toBe(3000);

    const reporte = await api().get("/api/admin/reportes/ventas").set(admin());
    expect(reporte.body.porMetodoPago).toEqual([
      { metodoPago: "EFECTIVO", comandas: 1, total: 10000 },
      { metodoPago: "TRANSFERENCIA", comandas: 1, total: 10000 },
      { metodoPago: "SIN_REGISTRAR", comandas: 1, total: 3000 },
    ]);
  });

  test("un pedido web cuenta al aprobar su pago y deja de contar si se cancela", async () => {
    await abrirCaja(50000);
    const cliente = bearer(d.tokenCliente);
    const { body: pedido } = await api().post("/api/pedidos").set(cliente)
      .send({ items: [{ menu_item_id: String(d.cafe._id), cantidad: 2 }] });
    const { body: pago } = await api().post("/api/pagos").set(cliente)
      .send({ pedido_id: pedido._id, metodo: "transferencia" });

    // Con el pago todavía por aprobar, la caja no lo espera.
    const pendiente = await api().get("/api/admin/caja").set(admin());
    expect(pendiente.body.cuadre.pedidosWeb).toBe(0);
    expect(pendiente.body.cuadre.esperado.TRANSFERENCIA).toBe(0);

    await api().patch(`/api/pagos/${pago._id}/estado`).set(admin()).send({ estado: "aprobado" });
    const aprobado = await api().get("/api/admin/caja").set(admin());
    expect(aprobado.body.cuadre.ventasWeb).toEqual({ EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 10000 });
    expect(aprobado.body.cuadre.pedidosWeb).toBe(1);
    // Las ventas de mesas siguen aparte.
    expect(aprobado.body.cuadre.ventas.TRANSFERENCIA).toBe(0);
    expect(aprobado.body.cuadre.esperado).toEqual({ EFECTIVO: 50000, TARJETA: 0, TRANSFERENCIA: 10000 });

    await api().patch(`/api/pedidos/${pedido._id}/estado`).set(admin()).send({ estado: "cancelado" });
    const cancelado = await api().get("/api/admin/caja").set(admin());
    expect(cancelado.body.cuadre.pedidosWeb).toBe(0);
    expect(cancelado.body.cuadre.esperado.TRANSFERENCIA).toBe(0);
  });

  test("una comanda cobrada con caja abierta queda ligada al arqueo", async () => {
    const { body: caja } = await abrirCaja();
    const res = await cobrar("EFECTIVO");
    const doc = await Comanda.findById(res.body.id);
    expect(String(doc.arqueo_id)).toBe(caja.arqueo.id);
  });
});

describe("Reportes", () => {
  test("ventas de hoy por día, método y plato", async () => {
    await cobrar("EFECTIVO", 2);
    await cobrar("TARJETA", 1);

    const res = await api().get("/api/admin/reportes/ventas").set(admin());
    expect(res.status).toBe(200);
    expect(res.body.resumen).toEqual({ comandas: 2, platos: 3, total: 15000, ticketPromedio: 7500, sinCaja: 2 });
    expect(res.body.porDia).toHaveLength(1);
    expect(res.body.porMetodoPago[0]).toEqual({ metodoPago: "EFECTIVO", comandas: 1, total: 10000 });
    expect(res.body.porPlato).toEqual([{ nombre: "Café", cantidad: 3, total: 15000 }]);
  });

  test("el día se cuenta en hora de Bogotá", async () => {
    await cobrar("EFECTIVO", 1);
    // 04:30 UTC del 11 = 23:30 del 10 en Bogotá.
    await Comanda.updateMany({}, { fecha_cierre: new Date("2026-03-11T04:30:00Z") });
    const el10 = await api().get("/api/admin/reportes/ventas?desde=2026-03-10&hasta=2026-03-10").set(admin());
    expect(el10.body.resumen.comandas).toBe(1);
    expect(el10.body.porDia[0].fecha).toBe("2026-03-10");
    const el11 = await api().get("/api/admin/reportes/ventas?desde=2026-03-11").set(admin());
    expect(el11.body.resumen.comandas).toBe(0);
  });

  test("con todo=true el informe no acota por fecha", async () => {
    await cobrar("EFECTIVO", 1);
    await cobrar("TARJETA", 1);
    const [vieja] = await Comanda.find().sort({ _id: 1 }).limit(1);
    await Comanda.updateOne({ _id: vieja._id }, { fecha_cierre: new Date("2020-05-05T17:00:00Z") });

    const hoy = await api().get("/api/admin/reportes/ventas").set(admin());
    expect(hoy.body.resumen.comandas).toBe(1);

    const todo = await api().get("/api/admin/reportes/ventas?todo=true").set(admin());
    expect(todo.status).toBe(200);
    expect(todo.body.desde).toBe(null);
    expect(todo.body.resumen.comandas).toBe(2);
    expect(todo.body.porDia.map((d) => d.fecha)[0]).toBe("2020-05-05");

    const consumo = await api().get("/api/admin/reportes/consumo?todo=true").set(admin());
    expect(consumo.status).toBe(200);

    const raro = await api().get("/api/admin/reportes/ventas?todo=quizas").set(admin());
    expect(raro.status).toBe(400);
  });

  test("rangos inválidos dan 400 en texto", async () => {
    const alReves = await api().get("/api/admin/reportes/ventas?desde=2026-03-10&hasta=2026-03-01").set(admin());
    expect(alReves.status).toBe(400);
    expect(alReves.text).toBe("La fecha inicial no puede ser posterior a la final");
    const mala = await api().get("/api/admin/reportes/consumo?desde=2026-02-31").set(admin());
    expect(mala.text).toBe("La fecha no es válida (formato AAAA-MM-DD)");
  });

  test("consumo lee el libro de movimientos", async () => {
    const { body: harina } = await api().post("/api/admin/insumos").set(admin())
      .send({ nombre: "Harina", unidad: "G", stock: 100, stockMinimo: 50 });
    await api().put(`/api/admin/recetas/${d.cafe._id}`).set(admin())
      .send({ items: [{ insumoId: harina.id, cantidad: 30 }] });
    await cobrar("EFECTIVO", 2);

    const res = await api().get("/api/admin/reportes/consumo").set(admin());
    expect(res.status).toBe(200);
    const fila = res.body.insumos[0];
    expect(fila.insumoId).toBe(harina.id);
    expect(fila.comprado).toBe(100);
    expect(fila.consumido).toBe(60);
    expect(fila.neto).toBe(60);
    expect(fila.stockActual).toBe(40);
    expect(fila.bajoMinimo).toBe(true);
  });
});
