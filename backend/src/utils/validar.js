const { z } = require("zod");
const { HttpError } = require("./http");
const { parseFecha } = require("./tiempo");
const { redondear2, redondear3 } = require("./dinero");

// Valida req[fuente] con un esquema zod y deja el resultado en req.valid[fuente].
// (En Express 5 req.query es de solo lectura, por eso no se reescribe.)
const validar = (schema, fuente = "body") => (req, res, next) => {
  const r = schema.safeParse(req[fuente] ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message || "Datos inválidos");
  req.valid = { ...req.valid, [fuente]: r.data };
  next();
};

const objectId = z
  .string({ error: "Identificador inválido" })
  .regex(/^[a-f\d]{24}$/i, "Identificador inválido");

const idParams = z.object({ id: objectId });

const texto = (campo, max = 255) =>
  z
    .string({ error: `${campo} es obligatorio` })
    .trim()
    .min(1, `${campo} es obligatorio`)
    .max(max, `${campo} es demasiado largo (máximo ${max} caracteres)`);

const textoOpcional = (campo, max = 255) =>
  z
    .string()
    .trim()
    .max(max, `${campo} es demasiado largo (máximo ${max} caracteres)`)
    .nullish()
    .transform((v) => v || null);

const email = z
  .string({ error: "El correo es obligatorio" })
  .trim()
  .toLowerCase()
  .max(255, "El correo es demasiado largo")
  .pipe(z.email({ error: "El correo no es válido" }));

const fecha = z.string({ error: "La fecha es obligatoria" }).transform((v, ctx) => {
  const dia = parseFecha(v);
  if (!dia) ctx.addIssue({ code: "custom", message: "La fecha no es válida (formato AAAA-MM-DD)" });
  return dia;
});

// Las cantidades del inventario llevan 3 decimales.
const cantidad = (campo, { minimo = 0 } = {}) =>
  z.coerce
    .number({ error: `${campo} es obligatorio` })
    .min(minimo, `${campo} no puede ser menor que ${minimo}`)
    .max(9_999_999, `${campo} es demasiado alto`)
    .transform(redondear3);

// El dinero lleva 2 decimales y un tope alto pero finito: un cero de más al
// teclear no debe poder descuadrar el arqueo en silencio.
const dinero = (campo, { minimo = 0 } = {}) =>
  z.coerce
    .number({ error: `${campo} es obligatorio` })
    .min(minimo, minimo === 0 ? `${campo} no puede ser negativo` : `${campo} debe ser mayor que ${minimo}`)
    .max(999_999_999, `${campo} es demasiado alto`)
    .transform(redondear2);

const booleanoQuery = (campo) =>
  z
    .enum(["true", "false"], { error: `El parámetro '${campo}' debe ser true o false` })
    .transform((v) => v === "true");

module.exports = { validar, objectId, idParams, texto, textoOpcional, email, fecha, cantidad, dinero, booleanoQuery };
