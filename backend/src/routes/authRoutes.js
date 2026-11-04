const { Router } = require("express");
const c = require("../controllers/authController");
const { auth } = require("../middleware/auth");
const { limiteAuth } = require("../middleware/limites");

const router = Router();

router.post("/registro", limiteAuth, c.registro);
router.post("/login", limiteAuth, c.login);
router.post("/google", limiteAuth, c.loginGoogle);
router.get("/perfil", auth, c.perfil);
router.post("/logout", auth, c.logout);

module.exports = router;
