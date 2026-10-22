const dotenv = require("dotenv");

dotenv.config();

const app = require("./app");
const connectDB = require("./config/database");

const PORT = process.env.PORT || 3000;

const iniciar = async () => {
    if (!process.env.JWT_SECRET) {
        console.error("Falta la variable de entorno JWT_SECRET (ver .env.example)");
        process.exit(1);
    }

    await connectDB();

    app.listen(PORT, () => {
        console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    });
};

iniciar();
