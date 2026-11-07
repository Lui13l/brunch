const dotenv = require("dotenv");

dotenv.config();

const http = require("node:http");
const mongoose = require("mongoose");
const app = require("./app");
const connectDB = require("./config/database");
const { adjuntarWebSocket } = require("./ws");

const PORT = process.env.PORT || 3000;

const iniciar = async () => {
    if (!process.env.JWT_SECRET) {
        console.error("Falta la variable de entorno JWT_SECRET (ver .env.example)");
        process.exit(1);
    }

    await connectDB();

    // Crea colecciones e índices que falten (no borra ninguno). Los índices
    // únicos parciales garantizan una comanda abierta por mesa y una caja abierta.
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));

    // Las comandas, el inventario y la caja usan transacciones: Atlas lo
    // soporta; un MongoDB local suelto (sin replica set) no.
    const hola = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hola.setName && hola.msg !== "isdbgrid") {
        console.warn("Aviso: MongoDB no es un replica set; enviar a cocina y otras operaciones fallarán. Usa Atlas o un replica set local.");
    }

    const server = http.createServer(app);
    const cerrarWs = adjuntarWebSocket(server);

    server.listen(PORT, () => {
        console.log(`Servidor ejecutándose en http://localhost:${PORT} (WebSocket en /ws)`);
    });

    const apagar = (senal) => {
        console.log(`${senal} recibido, cerrando...`);
        cerrarWs();
        server.close(async () => {
            await mongoose.disconnect();
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on("SIGINT", () => apagar("SIGINT"));
    process.on("SIGTERM", () => apagar("SIGTERM"));
};

iniciar();
