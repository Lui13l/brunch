const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect, crearPersonal } = require("./helpers");
const { Comanda, Insumo } = require("../src/models");

let d;
let mesero;
let cocina;
let mesa;
let harina;

before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);
beforeEach(async () => {
  await limpiar();
  d = await datosBase();
  mesero = await crearPersonal("mesero");
  cocina = await crearPersonal("cocina");
  mesa = (await api().post("/api/admin/mesas").set(admin()).send({ numero: 1 })).body;
  harina = (await api().post("/api/admin/insumos").set(admin())
    .send({ nombre: "Harina", unidad: "G", stock: 100, stockMinimo: 50 })).body;
  await api().put(`/api/admin/recetas/${d.huevos._id}`).set(admin())
    .send({ items: [{ insumoId: harina.id, cantidad: 80 }] });
});

const admin = () => bearer(d.tokenAdmin);
const m = () => bearer(mesero.token);
const k = () => bearer(cocina.token);
const HUEVOS = () => String(d.huevos._id);
const CAFE = () => String(d.cafe._id);
const SIN_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/;

const abrir = () => api().post("/api/comandas").set(m()).send({ mesaId: mesa.id });
const agregar = (id, menuItemId, extra = {}) =>
  api().post(`/api/comandas/${id}/items`).set(m()).send({ menuItemId, cantidad: 1, ...extra });
const enviar = (id) => api().post(`/api/comandas/${id}/enviar`).set(m());
const stock = async () => (await Insumo.findById(harina.id)).stock;

describe("Abrir comandas", () => {
  test("abre una cuenta con el contrato de la app", async () => {
    const res = await abrir();
    expect(res.status).toBe(200);
    expect(res.body.id).toMatch(/^[a-f\d]{24}$/);
    expect(res.body.mesaId).toBe(mesa.id);
    expect(res.body.mesaNumero).toBe(1);
    expect(res.body.meseroId).toBe(mesero.id);
    expect(res.body.estado).toBe("ABIERTA");
    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
    expect(res.body.fechaApertura).toMatch(SIN_Z);

    const mesas = await api().get("/api/mesas").set(m());
    expect(mesas.body[0].comandaAbiertaId).toBe(res.body.id);
  });

  test("dos meseros abriendo la misma mesa a la vez: uno gana", async () => {
    const estados = (await Promise.all([abrir(), abrir()])).map((r) => r.status).sort();
    expect(estados).toEqual([200, 409]);
    expect(await Comanda.countDocuments({ estado: "ABIERTA" })).toBe(1);
  });

  test("una mesa fuera de servicio no se abre y no se desactiva con cuenta abierta", async () => {
    const { body: c } = await abrir();
    const desactivar = await api().put(`/api/admin/mesas/${mesa.id}`).set(admin()).send({ numero: 1, activa: false });
    expect(desactivar.status).toBe(409);

    const borrar = await api().delete(`/api/admin/mesas/${mesa.id}`).set(admin());
    expect(borrar.status).toBe(409);
    expect(borrar.text).toBe("La mesa 1 ya tiene 1 comanda(s) registradas. Desactívala en vez de borrarla.");

    const otra = (await api().post("/api/admin/mesas").set(admin()).send({ numero: 2, activa: false })).body;
    const res = await api().post("/api/comandas").set(m()).send({ mesaId: otra.id });
    expect(res.status).toBe(409);
    expect(res.text).toBe("La mesa 2 está fuera de servicio");
    expect(c.id).toBeDefined();
  });

  test("la cocina no puede abrir cuentas", async () => {
    const res = await api().post("/api/comandas").set(k()).send({ mesaId: mesa.id });
    expect(res.status).toBe(403);
  });

  test("listar trae las abiertas y ?mias=true solo las propias", async () => {
    await abrir();
    const todas = await api().get("/api/comandas").set(admin());
    expect(todas.body).toHaveLength(1);
    const mias = await api().get("/api/comandas?mias=true").set(admin());
    expect(mias.body).toHaveLength(0);
  });
});

describe("Platos en borrador", () => {
  test("el mismo plato se agrupa; otra nota es otra línea; lo no vendible es 409", async () => {
    const { body: c } = await abrir();
    await agregar(c.id, HUEVOS());
    const dos = await agregar(c.id, HUEVOS());
    expect(dos.body.items).toHaveLength(1);
    expect(dos.body.items[0].cantidad).toBe(2);
    expect(dos.body.items[0].subtotal).toBe(40000);
    expect(dos.body.total).toBe(40000);

    const conNota = await agregar(c.id, HUEVOS(), { notas: "sin sal" });
    expect(conNota.body.items).toHaveLength(2);

    const viejo = await agregar(c.id, String(d.inactivo._id));
    expect(viejo.status).toBe(409);
    expect(viejo.text).toBe('"Viejo" no está disponible en el salón');
  });

  test("editar cantidad conserva las notas; quitar elimina la línea", async () => {
    const { body: c } = await abrir();
    const { body: conItem } = await agregar(c.id, HUEVOS(), { notas: "sin sal" });
    const itemId = conItem.items[0].id;

    const editado = await api().patch(`/api/comandas/${c.id}/items/${itemId}`).set(m()).send({ cantidad: 3 });
    expect(editado.body.items[0].cantidad).toBe(3);
    expect(editado.body.items[0].notas).toBe("sin sal");

    const quitado = await api().delete(`/api/comandas/${c.id}/items/${itemId}`).set(m());
    expect(quitado.body.items).toHaveLength(0);
  });
});

describe("Enviar a cocina", () => {
  test("descuenta por receta, avisa sin receta y no se puede editar lo enviado", async () => {
    const { body: c } = await abrir();
    await agregar(c.id, HUEVOS());
    await agregar(c.id, CAFE());
    const res = await enviar(c.id);
    expect(res.status).toBe(200);
    expect(res.body.faltantes).toEqual([]);
    expect(res.body.sinReceta).toEqual(["Café"]);
    expect(res.body.comanda.items.every((i) => i.estado === "PENDIENTE")).toBe(true);
    expect(res.body.comanda.items[0].fechaEnvio).toMatch(SIN_Z);
    expect(await stock()).toBe(20);

    const otraVez = await enviar(c.id);
    expect(otraVez.status).toBe(409);
    expect(otraVez.text).toBe("No hay platos nuevos que enviar");

    const itemId = res.body.comanda.items[0].id;
    const editar = await api().patch(`/api/comandas/${c.id}/items/${itemId}`).set(m()).send({ cantidad: 2 });
    expect(editar.status).toBe(409);
    expect(editar.text).toBe("El plato ya se envió a cocina: cancélalo en vez de modificarlo");
  });

  test("dos envíos simultáneos descuentan una sola vez", async () => {
    const { body: c } = await abrir();
    await agregar(c.id, HUEVOS());
    const estados = (await Promise.all([enviar(c.id), enviar(c.id)])).map((r) => r.status).sort();
    expect(estados).toEqual([200, 409]);
    expect(await stock()).toBe(20);
  });

  test("sin stock no se frena: queda negativo y se marca el faltante", async () => {
    const { body: c } = await abrir();
    await agregar(c.id, HUEVOS(), { cantidad: 2 });
    const res = await enviar(c.id);
    expect(res.status).toBe(200);
    expect(res.body.faltantes).toEqual([{ insumo: "Harina", unidad: "G", stock: -60 }]);
    expect(res.body.comanda.tieneFaltante).toBe(true);
    expect(res.body.comanda.items[0].faltoStock).toBe(true);
  });
});

describe("Cancelar y cocina", () => {
  test("cancelar devuelve lo que realmente se consumió aunque cambie la receta", async () => {
    const { body: c } = await abrir();
    await agregar(c.id, HUEVOS());
    const { body: enviado } = await enviar(c.id);
    await api().put(`/api/admin/recetas/${d.huevos._id}`).set(admin())
      .send({ items: [{ insumoId: harina.id, cantidad: 10 }] });

    const itemId = enviado.comanda.items[0].id;
    const res = await api().post(`/api/comandas/${c.id}/items/${itemId}/cancelar`).set(m());
    expect(res.status).toBe(200);
    expect(res.body.items[0].estado).toBe("CANCELADO");
    expect(res.body.total).toBe(0);
    expect(await stock()).toBe(100);

    const otraVez = await api().post(`/api/comandas/${c.id}/items/${itemId}/cancelar`).set(m());
    expect(otraVez.status).toBe(409);
    expect(otraVez.text).toBe("No se puede cancelar un plato que ya está cancelado");
  });

  test("la cocina ve la cola y marca PREPARANDO y LISTO; el mesero entrega", async () => {
    const { body: c } = await abrir();
    await agregar(c.id, HUEVOS(), { notas: "bien cocidos" });
    await enviar(c.id);

    const cola = await api().get("/api/cocina/pendientes").set(k());
    expect(cola.status).toBe(200);
    expect(cola.body).toHaveLength(1);
    const plato = cola.body[0];
    expect(plato.mesa).toBe(1);
    expect(plato.comandaId).toBe(c.id);
    expect(plato.nombre).toBe("Huevos");
    expect(plato.notas).toBe("bien cocidos");

    const meseroCocina = await api().get("/api/cocina/pendientes").set(m());
    expect(meseroCocina.status).toBe(403);

    const entregarAntes = await api().post(`/api/comandas/${c.id}/items/${plato.id}/entregar`).set(m());
    expect(entregarAntes.status).toBe(409);

    const prep = await api().patch(`/api/cocina/items/${plato.id}`).set(k()).send({ estado: "PREPARANDO" });
    expect(prep.body.estado).toBe("PREPARANDO");
    const listo = await api().patch(`/api/cocina/items/${plato.id}`).set(k()).send({ estado: "LISTO" });
    expect(listo.body.estado).toBe("LISTO");
    expect(listo.body.fechaListo).toMatch(SIN_Z);
    const otraVez = await api().patch(`/api/cocina/items/${plato.id}`).set(k()).send({ estado: "LISTO" });
    expect(otraVez.status).toBe(409);
    expect(otraVez.text).toBe("Ese plato ya está listo");

    expect((await api().get("/api/cocina/pendientes").set(k())).body).toHaveLength(0);

    const entregado = await api().post(`/api/comandas/${c.id}/items/${plato.id}/entregar`).set(m());
    expect(entregado.body.items[0].estado).toBe("ENTREGADO");
  });
});

describe("Cerrar la cuenta", () => {
  test("no cierra con borradores ni con platos en cocina (salvo admin forzando)", async () => {
    const { body: c } = await abrir();
    await agregar(c.id, CAFE());
    const borrador = await api().post(`/api/comandas/${c.id}/cerrar`).set(m()).send({ metodoPago: "EFECTIVO" });
    expect(borrador.status).toBe(409);
    expect(borrador.text).toBe("Hay 1 plato(s) sin enviar a cocina");

    await enviar(c.id);
    const enCocina = await api().post(`/api/comandas/${c.id}/cerrar`).set(m())
      .send({ metodoPago: "EFECTIVO", forzar: true });
    expect(enCocina.status).toBe(409);
    expect(enCocina.text).toBe("Todavía hay 1 plato(s) en cocina");

    const forzado = await api().post(`/api/comandas/${c.id}/cerrar`).set(admin())
      .send({ metodoPago: "TARJETA", forzar: true });
    expect(forzado.status).toBe(200);
    expect(forzado.body.estado).toBe("CERRADA");
  });

  test("cerrar congela el total, libera la mesa y no admite más cambios", async () => {
    const { body: c } = await abrir();
    await agregar(c.id, CAFE(), { cantidad: 2 });
    const { body: enviado } = await enviar(c.id);
    const itemId = enviado.comanda.items[0].id;
    await api().patch(`/api/cocina/items/${itemId}`).set(k()).send({ estado: "LISTO" });

    const metodoMalo = await api().post(`/api/comandas/${c.id}/cerrar`).set(m()).send({ metodoPago: "BITCOIN" });
    expect(metodoMalo.status).toBe(400);

    const res = await api().post(`/api/comandas/${c.id}/cerrar`).set(m()).send({ metodoPago: "EFECTIVO" });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(10000);
    expect(res.body.metodoPago).toBe("EFECTIVO");
    expect(res.body.fechaCierre).toMatch(SIN_Z);

    const doc = await Comanda.findById(c.id);
    expect(doc.total).toBe(10000);
    expect(doc.arqueo_id).toBe(null);

    const mas = await agregar(c.id, CAFE());
    expect(mas.status).toBe(409);
    expect(mas.text).toBe("La comanda ya está cerrada");

    expect((await abrir()).status).toBe(200);
  });
});
