const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect, crearPersonal } = require("./helpers");
const { Insumo, Order, MovimientoInventario } = require("../src/models");

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
