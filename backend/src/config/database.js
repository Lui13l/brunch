const mongoose = require("mongoose");

// Traduce los errores de conexión más comunes a una explicación con la solución.
const explicarError = (error, uri) => {
    const mensaje = `${error.message} ${error.reason?.message || ""}`;

    if (!uri) {
        return "No hay MONGO_URI. Crea backend/.env a partir de .env.example y pon la cadena de conexión.";
    }
    if (/bad auth|authentication failed/i.test(mensaje)) {
        return "Usuario o contraseña incorrectos. Revísalos en Atlas > Database Access. Si la contraseña tiene caracteres especiales (@ : / ? # %), hay que codificarlos en la URI (por ejemplo @ -> %40).";
    }
    if (/whitelist|not authorized to access|IP.*(access list|allow)/i.test(mensaje)) {
        return "Atlas está bloqueando tu IP. En Atlas > Network Access añade tu IP actual (o 0.0.0.0/0 para permitir cualquier IP).";
    }
    if (/querySrv|ENOTFOUND|EREFUSED|ETIMEOUT/i.test(mensaje)) {
        return "No se pudo resolver la dirección del cluster. Revisa que la URI esté bien copiada. Si lo está, tu red o tu DNS bloquea las consultas SRV: prueba con otra red, cambia el DNS a 8.8.8.8, o usa la cadena de conexión 'standard' (mongodb://...) que ofrece Atlas.";
    }
    if (/Server selection timed out|ECONNREFUSED|ECONNRESET/i.test(mensaje)) {
        return uri.includes("mongodb+srv")
            ? "No hubo respuesta del cluster. Lo más común: tu IP no está en Atlas > Network Access, o el cluster está pausado (en ese caso, pulsa Resume en Atlas)."
            : "No hubo respuesta del servidor. Si es una base local, comprueba que MongoDB esté encendido.";
    }
    return null;
};

const connectDB = async () => {
    const uri = process.env.MONGO_URI;

    try {
        if (!uri) throw new Error("MONGO_URI no está definida");
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

        const { host, name } = mongoose.connection;
        const tipo = uri.startsWith("mongodb+srv") ? "MongoDB Atlas" : "MongoDB";
        console.log(`${tipo} conectado: ${host} (base de datos "${name}")`);
    } catch (error) {
        console.error("Error al conectar con MongoDB:");
        console.error(`  ${error.message}`);

        const solucion = explicarError(error, uri);
        if (solucion) console.error(`  Posible causa: ${solucion}`);

        process.exit(1);
    }
};

module.exports = connectDB;
