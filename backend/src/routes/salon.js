const { Router } = require("express");
const { auth, requireRole } = require("../middleware/auth");
const { enTexto } = require("../middleware/errores");
const { validar, idParams } = require("../utils/validar");
const mesas = require("../controllers/mesaController");
const menu = require("../controllers/menuAdminController");
const c = require("../controllers/comandaController");

// Rutas del salón (app de comandas). Errores en texto plano.
const router = Router();
const personal = [enTexto, auth, requireRole("mesero", "cocina", "admin")];

router.get("/mesas", ...personal, mesas.listar);
router.get("/salon/menu", ...personal, menu.menuSalon);

const comandas = Router();
comandas.use(enTexto, auth, requireRole("mesero", "admin"));
comandas.get("/", c.listar);
comandas.post("/", validar(c.abrirSchema), c.abrir);
comandas.get("/:id", validar(idParams, "params"), c.detalle);
comandas.post("/:id/items", validar(idParams, "params"), validar(c.agregarItemSchema), c.agregarItem);
comandas.patch("/:id/items/:itemId", validar(c.itemParams, "params"), validar(c.editarItemSchema), c.editarItem);
comandas.delete("/:id/items/:itemId", validar(c.itemParams, "params"), c.quitarItem);
comandas.post("/:id/items/:itemId/cancelar", validar(c.itemParams, "params"), c.cancelarItem);
comandas.post("/:id/items/:itemId/entregar", validar(c.itemParams, "params"), c.entregarItem);
comandas.post("/:id/enviar", validar(idParams, "params"), c.enviarACocina);
comandas.post("/:id/cerrar", validar(idParams, "params"), validar(c.cerrarSchema), c.cerrar);
router.use("/comandas", comandas);

const cocina = Router();
cocina.use(enTexto, auth, requireRole("cocina", "admin"));
cocina.get("/pendientes", c.colaCocina);
cocina.patch("/items/:id", validar(idParams, "params"), validar(c.estadoCocinaSchema), c.cambiarEstadoCocina);
router.use("/cocina", cocina);

module.exports = router;
