const { z } = require("zod");
const { Comanda } = require("../models");
const { objectId, textoOpcional } = require("../utils/validar");

// Validación de las rutas del salón y la cocina (mismos mensajes que la API anterior).

const abrirSchema = z.object({
  mesaId: objectId,
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

const cerrarSchema = z.object({
  metodoPago: z.enum(Comanda.METODOS_PAGO, { error: "El método de pago debe ser EFECTIVO, TARJETA o TRANSFERENCIA" }),
  // Salida de emergencia para el admin: cerrar aunque queden platos en cocina.
  forzar: z.boolean().default(false),
});

const estadoCocinaSchema = z.object({
  estado: z.enum(["PREPARANDO", "LISTO"], { error: "La cocina solo puede marcar PREPARANDO o LISTO" }),
});

const itemParams = z.object({ id: objectId, itemId: objectId });

module.exports = { abrirSchema, agregarItemSchema, editarItemSchema, cerrarSchema, estadoCocinaSchema, itemParams };
