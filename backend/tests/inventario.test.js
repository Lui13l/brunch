const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect, ID_INEXISTENTE } = require("./helpers");

let d;

before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);
beforeEach(async () => {
  await limpiar();
  d = await datosBase();
});

const admin = () => bearer(d.tokenAdmin);
const crearInsumo = (extra = {}) =>
  api().post("/api/admin/insumos").set(admin())
    .send({ nombre: "Harina", unidad: "G", stock: 100, stockMinimo: 50, activo: true, ...extra });

describe("Insumos", () => {
  test("crear con stock deja un movimiento COMPRA de stock inicial", async () => {
    const res = await crearInsumo();
    expect(res.status).toBe(200);
    expect(res.body.id).toMatch(/^[a-f\d]{24}$/);
    expect(res.body.stock).toBe(100);
    expect(res.body.stockMinimo).toBe(50);
    expect(res.body.bajoMinimo).toBe(false);

    const movs = await api().get(`/api/admin/insumos/${res.body.id}/movimientos`).set(admin());
    expect(movs.body).toHaveLength(1);
    expect(movs.body[0].tipo).toBe("COMPRA");
    expect(movs.body[0].motivo).toBe("Stock inicial");
    expect(movs.body[0].stockResultante).toBe(100);
  });

  test("valida unidad y nombre duplicado", async () => {
    const mala = await crearInsumo({ unidad: "KG" });
    expect(mala.status).toBe(400);
    expect(mala.text).toBe("La unidad debe ser G, ML o UND");

    await crearInsumo();
    const dup = await crearInsumo();
    expect(dup.status).toBe(409);
  });

  test("los ajustes redondean a 3 decimales y AJUSTE necesita motivo", async () => {
    const { body: insumo } = await crearInsumo({ stock: 0, unidad: "ML" });
    const sinMotivo = await api().post(`/api/admin/insumos/${insumo.id}/ajuste`).set(admin()).send({ cantidad: 1 });
    expect(sinMotivo.status).toBe(400);
    expect(sinMotivo.text).toBe("Un ajuste manual necesita un motivo");

    await api().post(`/api/admin/insumos/${insumo.id}/ajuste`).set(admin()).send({ cantidad: 0.1, tipo: "COMPRA" });
    const r = await api().post(`/api/admin/insumos/${insumo.id}/ajuste`).set(admin()).send({ cantidad: 0.2, tipo: "COMPRA" });
    expect(r.status).toBe(200);
    expect(r.body.stock).toBe(0.3);

    const negativo = await api().post(`/api/admin/insumos/${insumo.id}/ajuste`).set(admin())
      .send({ cantidad: -1, motivo: "Se derramó" });
    expect(negativo.body.stock).toBe(-0.7);
    expect(negativo.body.bajoMinimo).toBe(true);

    const movs = await api().get(`/api/admin/insumos/${insumo.id}/movimientos`).set(admin());
    expect(movs.body.map((m) => m.tipo)).toEqual(["AJUSTE", "COMPRA", "COMPRA"]);
  });

  test("editar no toca el stock", async () => {
    const { body: insumo } = await crearInsumo();
    const r = await api().put(`/api/admin/insumos/${insumo.id}`).set(admin())
      .send({ nombre: "Harina de trigo", unidad: "G", stockMinimo: 10, activo: true, stock: 999 });
    expect(r.body.nombre).toBe("Harina de trigo");
    expect(r.body.stock).toBe(100);
  });

  test("no se borra un insumo con historia ni uno usado en recetas", async () => {
    const { body: conStock } = await crearInsumo();
    const r1 = await api().delete(`/api/admin/insumos/${conStock.id}`).set(admin());
    expect(r1.status).toBe(409);
    expect(r1.text).toBe('"Harina" ya tiene movimientos registrados. Desactívalo en vez de borrarlo.');

    const { body: limpio } = await crearInsumo({ nombre: "Sal", stock: 0 });
    await api().put(`/api/admin/recetas/${d.huevos._id}`).set(admin())
      .send({ items: [{ insumoId: limpio.id, cantidad: 1 }] });
    const r2 = await api().delete(`/api/admin/insumos/${limpio.id}`).set(admin());
    expect(r2.status).toBe(409);

    const { body: libre } = await crearInsumo({ nombre: "Pimienta", stock: 0 });
    const r3 = await api().delete(`/api/admin/insumos/${libre.id}`).set(admin());
    expect(r3.status).toBe(204);
  });
});

describe("Recetas", () => {
  test("guardar reemplaza la receta completa y obtener la devuelve", async () => {
    const { body: harina } = await crearInsumo();
    const { body: leche } = await crearInsumo({ nombre: "Leche", unidad: "ML", stock: 0 });
    const plato = String(d.huevos._id);

    await api().put(`/api/admin/recetas/${plato}`).set(admin())
      .send({ items: [{ insumoId: harina.id, cantidad: 80 }, { insumoId: leche.id, cantidad: 100 }] });
    const r = await api().put(`/api/admin/recetas/${plato}`).set(admin())
      .send({ items: [{ insumoId: harina.id, cantidad: 90 }] });
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);

    const obtenida = await api().get(`/api/admin/recetas/${plato}`).set(admin());
    expect(obtenida.body.plato.id).toBe(plato);
    expect(obtenida.body.receta).toEqual([{ insumoId: harina.id, nombre: "Harina", unidad: "G", cantidad: 90 }]);
  });

  test("rechaza insumos repetidos o inexistentes", async () => {
    const { body: harina } = await crearInsumo();
    const plato = String(d.huevos._id);
    const rep = await api().put(`/api/admin/recetas/${plato}`).set(admin())
      .send({ items: [{ insumoId: harina.id, cantidad: 1 }, { insumoId: harina.id, cantidad: 2 }] });
    expect(rep.status).toBe(400);
    expect(rep.text).toBe("La receta tiene el mismo insumo repetido");

    const noExiste = await api().put(`/api/admin/recetas/${plato}`).set(admin())
      .send({ items: [{ insumoId: ID_INEXISTENTE, cantidad: 1 }] });
    expect(noExiste.text).toBe("Algún insumo de la receta no existe");

    const platoNo = await api().get(`/api/admin/recetas/${ID_INEXISTENTE}`).set(admin());
    expect(platoNo.status).toBe(404);
  });

  test("faltantes lista los platos sin receta", async () => {
    const { body: harina } = await crearInsumo();
    await api().put(`/api/admin/recetas/${d.huevos._id}`).set(admin())
      .send({ items: [{ insumoId: harina.id, cantidad: 1 }] });
    const r = await api().get("/api/admin/recetas/faltantes").set(admin());
    expect(r.status).toBe(200);
    expect(r.body.map((p) => p.nombre).sort()).toEqual(["Café", "Viejo"]);
  });

  test("borrar un plato borra su receta", async () => {
    const { body: harina } = await crearInsumo();
    await api().put(`/api/admin/recetas/${d.cafe._id}`).set(admin())
      .send({ items: [{ insumoId: harina.id, cantidad: 1 }] });
    await api().delete(`/api/admin/menu/${d.cafe._id}`).set(admin());
    const r = await api().delete(`/api/admin/insumos/${harina.id}`).set(admin());
    // Ya no está en recetas; solo lo frena su movimiento de stock inicial.
    expect(r.text).toBe('"Harina" ya tiene movimientos registrados. Desactívalo en vez de borrarlo.');
  });
});
