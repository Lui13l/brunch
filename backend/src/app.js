const express = require("express");
const cors = require("cors");

const rutas = require("./routes");
const { noEncontrado, manejarErrores } = require("./middleware/errores");

const app = express();
app.disable("x-powered-by");

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
