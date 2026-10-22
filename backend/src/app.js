const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const rutas = require("./routes");
const { noEncontrado, manejarErrores } = require("./middleware/errores");

const app = express();

// Si el servidor queda detrás de un proxy (Render, Railway, Nginx...), indica
// cuántos saltos hay para que el límite de intentos vea la IP real del cliente.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY));

// Cabeceras de seguridad (y oculta "X-Powered-By: Express").
app.use(helmet());

// CORS_ORIGIN admite varios orígenes separados por coma. Sin definir, permite todos.
const origenes = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());
app.use(cors(origenes ? { origin: origenes } : undefined));
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        mensaje: "Servidor de Brunch funcionando correctamente"
    });
});

app.use("/api", rutas);

app.use(noEncontrado);
app.use(manejarErrores);

module.exports = app;
