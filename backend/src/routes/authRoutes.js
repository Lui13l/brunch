const { Router } = require("express");
const c = require("../controllers/authController");
const { auth } = require("../middleware/auth");

const router = Router();

router.post("/registro", c.registro);
router.post("/login", c.login);
router.get("/perfil", auth, c.perfil);

module.exports = router;
