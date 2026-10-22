const { Router } = require("express");
const c = require("../controllers/authController");
const { auth } = require("../middleware/auth");
const { limiteAuth } = require("../middleware/limites");

const router = Router();

router.post("/registro", limiteAuth, c.registro);
router.post("/login", limiteAuth, c.login);
router.get("/perfil", auth, c.perfil);

module.exports = router;
