const { Router } = require("express");
const { validar, idParams } = require("../utils/validar");

const router = Router();

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

// App de comandas (personal del restaurante).
router.use("/", require("./salon"));
router.use("/admin", require("./admin"));

module.exports = router;
