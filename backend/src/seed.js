// Carga datos iniciales: roles, usuario admin, el menú (src/data/menu.js)
// e intenciones del chatbot (src/data/intenciones.js).
// Se puede ejecutar varias veces sin duplicar nada: npm run seed
const dotenv = require("dotenv");

dotenv.config();

const mongoose = require("mongoose");
const connectDB = require("./config/database");
const { Role, User, Category, MenuItem, ChatIntent } = require("./models");
const INTENCIONES = require("./data/intenciones");
const MENU = require("./data/menu");

const ROLES = [
    { _id: "admin", nombre: "Administrador" },
    { _id: "cliente", nombre: "Cliente" },
];

const seed = async () => {
    await connectDB();

    for (const rol of ROLES) {
        await Role.updateOne({ _id: rol._id }, rol, { upsert: true });
    }
    console.log(`Roles: ${ROLES.map((r) => r._id).join(", ")}`);

    const correoAdmin = (process.env.ADMIN_CORREO || "admin@brunch.com").toLowerCase();
    if (await User.exists({ correo: correoAdmin })) {
        console.log(`Admin ya existe: ${correoAdmin}`);
    } else {
        await User.create({
            nombre: "Administrador",
            correo: correoAdmin,
            password: process.env.ADMIN_PASSWORD || "admin123",
            rol_id: "admin",
        });
        console.log(`Admin creado: ${correoAdmin} (cambia la contraseña en producción)`);
    }

    let totalProductos = 0;
    for (const [orden, { categoria: nombreCategoria, tipo, productos }] of MENU.entries()) {
        const categoria = await Category.findOneAndUpdate(
            { nombre: nombreCategoria },
            { nombre: nombreCategoria, orden },
            { upsert: true, returnDocument: "after" }
        );

        for (const [posicion, producto] of productos.entries()) {
            await MenuItem.updateOne(
                { nombre: producto.nombre },
                { ...producto, tipo, orden: posicion, categoria_id: categoria._id },
                { upsert: true }
            );
            totalProductos++;
        }
    }
    console.log(`Categorías: ${MENU.length}, productos: ${totalProductos}`);

    // $setOnInsert: solo crea las que faltan, sin pisar las que el admin ya editó.
    let nuevas = 0;
    for (const intencion of INTENCIONES) {
        const r = await ChatIntent.updateOne(
            { nombre: intencion.nombre },
            { $setOnInsert: intencion },
            { upsert: true }
        );
        nuevas += r.upsertedCount;
    }
    console.log(`Intenciones del chatbot: ${nuevas} nuevas de ${INTENCIONES.length}`);

    await mongoose.disconnect();
};

seed().catch(async (error) => {
    console.error("Error en el seed:", error);
    await mongoose.disconnect();
    process.exit(1);
});
