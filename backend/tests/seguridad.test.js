// Límites bajos solo para este archivo (cada archivo de test corre en su propio proceso).
process.env.RATE_LIMIT_AUTH_MAX = "3";
process.env.RATE_LIMIT_CHAT_MAX = "2";

const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect } = require("./helpers");

let d;

before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);
beforeEach(async () => {
  await limpiar();
  d = await datosBase();
});

describe("Seguridad", () => {
  test("envía cabeceras de seguridad y oculta X-Powered-By", async () => {
    const res = await api().get("/");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  test("limita los mensajes al chatbot por usuario", async () => {
    const enviar = (token) =>
      api().post("/api/chat/mensaje").set(bearer(token)).send({ mensaje: "hola" });

    expect((await enviar(d.tokenCliente)).status).toBe(200);
    expect((await enviar(d.tokenCliente)).status).toBe(200);
    expect((await enviar(d.tokenCliente)).status).toBe(429);

    // El límite es por usuario: otro usuario puede seguir escribiendo.
    expect((await enviar(d.tokenAdmin)).status).toBe(200);
  });

  // Va al final: agota el cupo de la IP local y bloquearía el login de los
  // beforeEach siguientes (los tests se ejecutan en el orden en que están escritos).
  test("bloquea el login tras varios intentos fallidos", async () => {
    const intentar = (password) =>
      api().post("/api/auth/login").send({ correo: "ana@test.com", password });

    for (let i = 0; i < 3; i++) {
      expect((await intentar("mala")).status).toBe(401);
    }

    const bloqueado = await intentar("secreta1");
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.mensaje.includes("Demasiados intentos")).toBe(true);
  });
});
