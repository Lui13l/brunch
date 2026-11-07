const { describe, test, before, after, beforeEach } = require("node:test");
const { conectar, desconectar, limpiar, api, datosBase, bearer, expect, crearPersonal } = require("./helpers");
const { User } = require("../src/models");

before(conectar, { timeout: 10 * 60 * 1000 });
after(desconectar);
beforeEach(async () => {
  await limpiar();
  await datosBase();
});

describe("Login del personal (app de comandas)", () => {
  test("devuelve el usuario plano con rol en mayúscula y token", async () => {
    await User.create({ nombre: "Mario", correo: "mario@test.com", password: "clave123", rol_id: "mesero" });
    const res = await api().post("/api/usuarios/login").send({ email: "MARIO@test.com", password: "clave123" });

    expect(res.status).toBe(200);
    expect(res.body.id).toMatch(/^[a-f\d]{24}$/);
    expect(res.body.nombre).toBe("Mario");
    expect(res.body.email).toBe("mario@test.com");
    expect(res.body.rol).toBe("MESERO");
    expect(res.body.dosFaActivo).toBe(false);
    expect(res.body.cuentaGoogle).toBe(false);
    expect(res.body.password).toBeUndefined();
    expect(typeof res.body.token).toBe("string");

    // El token sirve para el resto de la API.
    const perfil = await api().get("/api/auth/perfil").set(bearer(res.body.token));
    expect(perfil.status).toBe(200);
  });

  test("un cliente entra como USUARIO (la app lo rechaza)", async () => {
    const res = await api().post("/api/usuarios/login").send({ email: "ana@test.com", password: "secreta1" });
    expect(res.status).toBe(200);
    expect(res.body.rol).toBe("USUARIO");
  });

  test("credenciales malas o incompletas dan 401 en texto", async () => {
    const mala = await api().post("/api/usuarios/login").send({ email: "ana@test.com", password: "mala" });
    expect(mala.status).toBe(401);
    expect(mala.type).toBe("text/plain");
    expect(mala.text).toBe("Credenciales incorrectas");

    const vacia = await api().post("/api/usuarios/login").send({});
    expect(vacia.status).toBe(401);
  });

  test("una cuenta desactivada no entra y su token deja de servir", async () => {
    const { usuario, token } = await crearPersonal("cocina");
    await User.updateOne({ _id: usuario._id }, { activo: false });

    const login = await api().post("/api/usuarios/login").send({ email: "cocina@test.com", password: "clave123" });
    expect(login.status).toBe(401);

    const perfil = await api().get("/api/auth/perfil").set(bearer(token));
    expect(perfil.status).toBe(401);
  });

  test("el login web de una cuenta desactivada da 403 en JSON", async () => {
    await User.updateOne({ correo: "ana@test.com" }, { activo: false });
    const res = await api().post("/api/auth/login").send({ correo: "ana@test.com", password: "secreta1" });
    expect(res.status).toBe(403);
    expect(typeof res.body.mensaje).toBe("string");
  });

  test("los errores de la web siguen siendo JSON {mensaje}", async () => {
    const res = await api().put("/api/usuarios/perfil").send({});
    expect(res.status).toBe(401);
    expect(typeof res.body.mensaje).toBe("string");
  });
});
