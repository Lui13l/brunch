const { Router } = require("express");
const { z } = require("zod");
const { validar, idParams } = require("../utils/validar");

const router = Router();

const festivosQuery = z.object({
  anio: z.coerce
    .number({ error: "El año es obligatorio" })
    .int("El año no es válido")
    .min(2000, "El año no es válido")
    .max(2100, "El año no es válido"),
});

router.use("/auth", require("./authRoutes"));
router.use("/usuarios", require("./usuarioRoutes"));
router.use("/categorias", require("./categoriaRoutes"));
router.use("/productos", require("./productoRoutes"));
router.use("/pedidos", require("./pedidoRoutes"));
router.use("/reservas", require("./reservaRoutes"));
router.use("/pagos", require("./pagoRoutes"));
router.use("/facturas", require("./facturaRoutes"));
router.use("/domiciliarios", require("./domiciliarioRoutes"));
router.use("/chat", require("./chatRoutes"));

// Fotos de platos subidas desde el panel. Verlas no pide sesión.
router.get("/imagenes/:id", validar(idParams, "params"), require("../controllers/imagenController").ver);

// Clima de hoy donde está el local (portada y menú). La clave de OpenWeather
// vive aquí y no en el navegador. Sin datos responde 204 y la web no lo muestra.
router.get("/clima", async (req, res) => {
  const clima = await require("../services/clima").climaActual();
  if (!clima) return res.status(204).end();
  res.set("Cache-Control", "public, max-age=600").json(clima);
});

// Festivos de Colombia de un año: [{ fecha, nombre }]. Públicos: la web los
// usa para el horario y la app del personal para marcar los reportes.
router.get("/festivos", validar(festivosQuery, "query"), async (req, res) => {
  const festivos = await require("../services/festivos").festivosDe(req.valid.query.anio);
  res.set("Cache-Control", "public, max-age=3600").json(festivos);
});

// App de comandas (personal del restaurante).
router.use("/", require("./salon"));
router.use("/admin", require("./admin"));

module.exports = router;
