const { describe, test, before, after } = require("node:test");
const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { z } = require("zod");
const { conectar, desconectar, expect } = require("./helpers");

before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);

describe("Utilidades de tiempo (America/Bogota)", () => {
  const t = require("../src/utils/tiempo");

  test("fechaLocal da la hora de Bogotá sin Z", () => {
    expect(t.fechaLocal(new Date("2026-03-10T17:05:09.123Z"))).toBe("2026-03-10T12:05:09.123");
    expect(t.fechaLocal(null)).toBe(null);
  });

  test("diaLocal usa el día de Bogotá aunque en UTC ya sea el siguiente", () => {
    expect(t.diaLocal(new Date("2026-03-11T04:30:00Z"))).toBe("2026-03-10");
  });

  test("inicioDiaLocal convierte un día de Bogotá a su instante UTC", () => {
    expect(t.inicioDiaLocal("2026-03-10").toISOString()).toBe("2026-03-10T05:00:00.000Z");
  });

  test("parseFecha rechaza fechas imposibles", () => {
    expect(t.parseFecha("2026-02-31")).toBe(null);
    expect(t.parseFecha("2026-02-28")).toBe("2026-02-28");
    expect(t.parseFecha("ayer")).toBe(null);
  });
});

describe("Utilidades de dinero", () => {
  const { redondear2, redondear3 } = require("../src/utils/dinero");
  test("redondea sin arrastrar errores de coma flotante", () => {
    expect(redondear3(0.1 + 0.2)).toBe(0.3);
    expect(redondear2(10.005)).toBe(10.01);
  });
});

describe("Roles", () => {
  const { rolPublico, rolInterno } = require("../src/utils/roles");
  test("traduce entre el rol de la base y el del personal", () => {
    expect(rolPublico("cliente")).toBe("USUARIO");
    expect(rolPublico("mesero")).toBe("MESERO");
    expect(rolInterno("COCINA")).toBe("cocina");
    expect(rolInterno("USUARIO")).toBe("cliente");
    expect(rolInterno("OTRO")).toBe(null);
  });
});

describe("Transacciones", () => {
  test("conTransaccion confirma y devuelve el resultado; si falla no deja nada", async () => {
    const { conTransaccion } = require("../src/utils/transaccion");
    const Prueba = mongoose.models.PruebaTx || mongoose.model("PruebaTx", new mongoose.Schema({ n: Number }));
    await Prueba.createCollection();

    const r = await conTransaccion(async (session) => {
      await Prueba.create([{ n: 1 }], { session });
      return "ok";
    });
    expect(r).toBe("ok");

    await conTransaccion(async (session) => {
      await Prueba.create([{ n: 2 }], { session });
      throw new Error("falla");
    }).catch(() => {});
    expect(await Prueba.countDocuments()).toBe(1);
  });
});

describe("Errores en texto para el personal", () => {
  const { HttpError } = require("../src/utils/http");
  const { enTexto, noEncontrado, manejarErrores } = require("../src/middleware/errores");
  const { validar, objectId } = require("../src/utils/validar");

  const app = express();
  app.use(express.json());
  app.get("/web", () => { throw new HttpError(409, "Choque web"); });
  app.use("/staff", enTexto);
  app.get("/staff/falla", () => { throw new HttpError(409, "Choque staff"); });
  app.post(
    "/staff/valida/:id",
    validar(z.object({ id: objectId }), "params"),
    validar(z.object({ n: z.number({ error: "n es obligatorio" }) })),
    (req, res) => res.json({ id: req.valid.params.id, n: req.valid.body.n })
  );
  app.use(noEncontrado);
  app.use(manejarErrores);

  test("las rutas web siguen respondiendo JSON {mensaje}", async () => {
    const res = await request(app).get("/web");
    expect(res.status).toBe(409);
    expect(res.body.mensaje).toBe("Choque web");
  });

  test("las rutas del personal responden texto plano", async () => {
    const res = await request(app).get("/staff/falla");
    expect(res.status).toBe(409);
    expect(res.type).toBe("text/plain");
    expect(res.text).toBe("Choque staff");
    const nf = await request(app).get("/staff/nada");
    expect(nf.status).toBe(404);
    expect(nf.type).toBe("text/plain");
  });

  test("validar entrega datos limpios o un 400 con el primer mensaje", async () => {
    const ok = await request(app).post("/staff/valida/507f1f77bcf86cd799439011").send({ n: 3 });
    expect(ok.status).toBe(200);
    expect(ok.body.n).toBe(3);
    const malId = await request(app).post("/staff/valida/123").send({ n: 3 });
    expect(malId.status).toBe(400);
    expect(malId.text).toBe("Identificador inválido");
    const sinN = await request(app).post("/staff/valida/507f1f77bcf86cd799439011").send({});
    expect(sinN.text).toBe("n es obligatorio");
  });
});

describe("Hub de tiempo real: permisos de temas", () => {
  const { puedeSuscribirse } = require("../src/ws/hub");
  const id = "507f1f77bcf86cd799439011";
  const otro = "507f1f77bcf86cd799439012";

  test("aplica la ACL por rol", () => {
    expect(puedeSuscribirse({ id, rol: "admin" }, "/topic/admin/caja")).toBe(true);
    expect(puedeSuscribirse({ id, rol: "mesero" }, "/topic/admin/caja")).toBe(false);
    expect(puedeSuscribirse({ id, rol: "cocina" }, "/topic/cocina")).toBe(true);
    expect(puedeSuscribirse({ id, rol: "mesero" }, "/topic/cocina")).toBe(false);
    expect(puedeSuscribirse({ id, rol: "mesero" }, "/topic/salon")).toBe(true);
    expect(puedeSuscribirse({ id, rol: "cliente" }, "/topic/salon")).toBe(false);
    expect(puedeSuscribirse({ id, rol: "mesero" }, `/topic/mesero/${id}/comandas`)).toBe(true);
    expect(puedeSuscribirse({ id, rol: "mesero" }, `/topic/mesero/${otro}/comandas`)).toBe(false);
    expect(puedeSuscribirse({ id, rol: "admin" }, `/topic/mesero/${otro}/comandas`)).toBe(true);
    expect(puedeSuscribirse({ id, rol: "cliente" }, `/topic/usuario/${id}/pedido`)).toBe(true);
    expect(puedeSuscribirse({ id, rol: "admin" }, `/topic/usuario/${otro}/pedido`)).toBe(false);
    expect(puedeSuscribirse({ id, rol: "admin" }, "/topic/inventado")).toBe(false);
  });
});

describe("Código corto y total de una comanda", () => {
  test("codigoCorto muestra los últimos 6 caracteres del id con #", () => {
    const { codigoCorto } = require("../src/utils/codigo");
    expect(codigoCorto("6aee9828fefb9cd14c2a04ea")).toBe("#2A04EA");
    expect(codigoCorto(null)).toBe("#");
  });

  test("calcularTotal suma lo no cancelado sin depender del serializador", () => {
    const { calcularTotal } = require("../src/services/comandas");
    const items = [
      { precio_unitario: 1000.1, cantidad: 2, estado: "LISTO" },
      { precio_unitario: 500, cantidad: 1, estado: "CANCELADO" },
      { precio_unitario: 0.2, cantidad: 1, estado: "ENTREGADO" },
    ];
    expect(calcularTotal(items)).toBe(2000.4);
  });
});

describe("Rango de días del restaurante", () => {
  test("rangoLocal incluye el día final completo y respeta los extremos abiertos", () => {
    const { rangoLocal } = require("../src/utils/tiempo");
    const r = rangoLocal("2026-03-10", "2026-03-11");
    expect(r.inicio.toISOString()).toBe("2026-03-10T05:00:00.000Z");
    expect(r.fin.toISOString()).toBe("2026-03-12T05:00:00.000Z");
    expect(rangoLocal(undefined, "2026-03-10").inicio).toBe(undefined);
    expect(rangoLocal("2026-03-10").fin).toBe(undefined);
  });
});
