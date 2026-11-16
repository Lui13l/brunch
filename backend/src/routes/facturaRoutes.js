const { Router } = require("express");
const c = require("../controllers/facturaController");
const { auth, requireRole } = require("../middleware/auth");
const { auditar } = require("../middleware/auditar");
const { SERVICIO } = require("../services/auditoria");
const { validar, idParams } = require("../utils/validar");
const { codigoCorto } = require("../utils/codigo");
const { ROL } = require("../utils/roles");

const router = Router();

router.use(auth, requireRole(ROL.ADMIN));

router.get("/", validar(c.listarSchema, "query"), c.listar);
router.get("/pendientes", c.pendientes);
router.post(
  "/",
  validar(c.generarSchema),
  auditar(SERVICIO.PEDIDOS, "GENERAR_FACTURA", (req, b) => `Generó el comprobante ${b.numero} del pedido web ${codigoCorto(b.pedidoId)}`),
  c.generar
);
router.post(
  "/:id/enviar",
  validar(idParams, "params"),
  auditar(SERVICIO.PEDIDOS, "ENVIAR_FACTURA", (req, b) => `Reenvió el comprobante ${b.numero}: ${b.envio.estado}`),
  c.reenviar
);
router.get("/:id/pdf", validar(idParams, "params"), c.pdf);

module.exports = router;
