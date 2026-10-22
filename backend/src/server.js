const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/database");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

connectDB();

app.get("/", (req, res) => {
    res.json({
        mensaje: "Servidor de Brunch funcionando correctamente"
    });
});

app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});