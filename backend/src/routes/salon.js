const { Router } = require("express");
const { auth, requireRole } = require("../middleware/auth");
const { enTexto } = require("../middleware/errores");
const { validar, idParams } = require("../utils/validar");
const mesas = require("../controllers/mesaController");
const menu = require("../controllers/menuAdminController");
const c = require("../controllers/comandaController");
const k = require("../controllers/cocinaController");
const esquemas = require("../schemas/comandas");
const { ROL } = require("../utils/roles");

// Rutas del salón (app de comandas). Errores en texto plano.
const router = Router();
const personal = [enTexto, auth, requireRole(ROL.MESERO, ROL.COCINA, ROL.ADMIN)];

router.get("/mesas", ...personal, mesas.listar);
router.get("/salon/menu", ...personal, menu.menuSalon);

const comandas = Router();
comandas.use(enTexto, auth, requireRole(ROL.MESERO, ROL.ADMIN));
comandas.get("/", c.listar);
comandas.post("/", validar(esquemas.abrirSchema), c.abrir);
comandas.get("/:id", validar(idParams, "params"), c.detalle);
comandas.post("/:id/items", validar(idParams, "params"), validar(esquemas.agregarItemSchema), c.agregarItem);
comandas.patch("/:id/items/:itemId", validar(esquemas.itemParams, "params"), validar(esquemas.editarItemSchema), c.editarItem);
comandas.delete("/:id/items/:itemId", validar(esquemas.itemParams, "params"), c.quitarItem);
comandas.post("/:id/items/:itemId/cancelar", validar(esquemas.itemParams, "params"), c.cancelarItem);
comandas.post("/:id/items/:itemId/entregar", validar(esquemas.itemParams, "params"), c.entregarItem);
comandas.post("/:id/enviar", validar(idParams, "params"), c.enviarACocina);
comandas.post("/:id/cerrar", validar(idParams, "params"), validar(esquemas.cerrarSchema), c.cerrar);
router.use("/comandas", comandas);

const cocina = Router();
cocina.use(enTexto, auth, requireRole(ROL.COCINA, ROL.ADMIN));
cocina.get("/pendientes", k.colaCocina);
cocina.patch("/items/:id", validar(idParams, "params"), validar(esquemas.estadoCocinaSchema), k.cambiarEstadoCocina);
router.use("/cocina", cocina);

module.exports = router;
