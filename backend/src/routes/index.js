const { Router } = require("express");

const router = Router();

router.use("/auth", require("./authRoutes"));
router.use("/usuarios", require("./usuarioRoutes"));
router.use("/categorias", require("./categoriaRoutes"));
router.use("/productos", require("./productoRoutes"));
router.use("/pedidos", require("./pedidoRoutes"));
router.use("/reservas", require("./reservaRoutes"));
router.use("/pagos", require("./pagoRoutes"));
router.use("/domiciliarios", require("./domiciliarioRoutes"));
router.use("/chat", require("./chatRoutes"));

module.exports = router;
