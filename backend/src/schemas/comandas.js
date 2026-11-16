const { z } = require("zod");
const { Comanda } = require("../models");
const { objectId, textoOpcional, dinero } = require("../utils/validar");

// Validación de las rutas del salón y la cocina (mismos mensajes que la API anterior).

// Mesas que se juntan a la principal para un grupo grande.
const mesasExtra = z
  .array(objectId, { error: "Las mesas juntas deben ser una lista" })
  .max(6, "No se pueden juntar más de 6 mesas a una cuenta");

const abrirSchema = z.object({
  mesaId: objectId,
  mesasExtra: mesasExtra.default([]),
  comensales: z.coerce
    .number({ error: "El número de comensales debe ser un número" })
    .int("El número de comensales debe ser entero")
    .min(1, "Debe haber al menos 1 comensal")
    .max(100, "Demasiados comensales para una sola mesa")
    .nullish(),
  notas: textoOpcional("Las notas"),
});

const cantidadPlato = z.coerce
  .number({ error: "La cantidad es obligatoria" })
  .int("La cantidad debe ser un número entero")
  .min(1, "La cantidad mínima es 1")
  .max(99, "Cantidad demasiado alta para un solo plato");

const agregarItemSchema = z.object({
  menuItemId: objectId,
  cantidad: cantidadPlato.default(1),
  notas: textoOpcional("Las notas"),
});

const editarItemSchema = z.object({ cantidad: cantidadPlato, notas: textoOpcional("Las notas") });

const metodoPago = z.enum(Comanda.METODOS_PAGO, {
  error: "El método de pago debe ser EFECTIVO, TARJETA o TRANSFERENCIA",
});

// Una parte de la cuenta dividida. El monto lo propone la app, pero el servidor
// exige que la suma dé el total que él mismo calcula.
const pagoSchema = z.object({
  metodo: metodoPago,
  monto: dinero("El monto de cada pago", { minimo: 0 }).refine((v) => v > 0, "El monto de cada pago debe ser mayor que 0"),
  etiqueta: textoOpcional("La etiqueta del pago", 40),
});

// Se cobra de una vez (`metodoPago`) o dividido (`pagos`), no las dos cosas.
const cerrarSchema = z
  .object({
    metodoPago: metodoPago.optional(),
    pagos: z
      .array(pagoSchema, { error: "Los pagos deben ser una lista" })
      .min(1, "Indica al menos un pago")
      .max(20, "No se puede dividir la cuenta en más de 20 pagos")
      .optional(),
    // Salida de emergencia para el admin: cerrar aunque queden platos en cocina.
    forzar: z.boolean().default(false),
  })
  .refine((d) => Boolean(d.metodoPago) !== Boolean(d.pagos), {
    message: "Indica el método de pago o los pagos de la cuenta dividida",
  });

const estadoCocinaSchema = z.object({
  estado: z.enum(["PREPARANDO", "LISTO"], { error: "La cocina solo puede marcar PREPARANDO o LISTO" }),
});

const itemParams = z.object({ id: objectId, itemId: objectId });

const mesasSchema = z.object({ mesasExtra });

module.exports = { mesasSchema, abrirSchema, agregarItemSchema, editarItemSchema, cerrarSchema, estadoCocinaSchema, itemParams };
