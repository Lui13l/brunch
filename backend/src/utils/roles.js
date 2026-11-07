// En la base los roles van en minúscula (rol_id). La app de comandas los
// recibe en mayúscula, y "cliente" se llama "USUARIO" como en la API anterior.
const ROL = Object.freeze({ ADMIN: "admin", CLIENTE: "cliente", MESERO: "mesero", COCINA: "cocina" });
const ROLES_PERSONAL = [ROL.ADMIN, ROL.MESERO, ROL.COCINA];

const A_PUBLICO = { admin: "ADMIN", cliente: "USUARIO", mesero: "MESERO", cocina: "COCINA" };
const A_INTERNO = Object.fromEntries(Object.entries(A_PUBLICO).map(([k, v]) => [v, k]));

const rolPublico = (rolId) => A_PUBLICO[rolId] || "USUARIO";
const rolInterno = (rol) => A_INTERNO[String(rol || "").toUpperCase()] || null;

module.exports = { ROL, ROLES_PERSONAL, rolPublico, rolInterno };
