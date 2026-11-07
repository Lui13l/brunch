// Carga datos iniciales: roles, usuario admin, el menú (src/data/menu.js)
// e intenciones del chatbot (src/data/intenciones.js).
// Se puede ejecutar varias veces sin duplicar nada: npm run seed
const mongoose = require("mongoose");
const connectDB = require("./config/database");
const { Role, User, Category, MenuItem, ChatIntent, Mesa } = require("./models");
const INTENCIONES = require("./data/intenciones");
const MENU = require("./data/menu");

const ROLES = [
    { _id: "admin", nombre: "Administrador" },
    { _id: "cliente", nombre: "Cliente" },
    { _id: "mesero", nombre: "Mesero" },
    { _id: "cocina", nombre: "Cocina" },
];

// Carta inicial. $setOnInsert: crea lo que falta y nunca pisa lo que el admin
// ya editó (precio, descripción, orden, categoría) en la base compartida.
const sembrarMenu = async () => {
    let total = 0;
    for (const [orden, { categoria: nombreCategoria, tipo, productos }] of MENU.entries()) {
        const categoria = await Category.findOneAndUpdate(
            { nombre: nombreCategoria },
            { $setOnInsert: { nombre: nombreCategoria, orden } },
            { upsert: true, returnDocument: "after" }
        );
        for (const [posicion, producto] of productos.entries()) {
            await MenuItem.updateOne(
                { nombre: producto.nombre },
                { $setOnInsert: { ...producto, tipo, orden: posicion, categoria_id: categoria._id } },
                { upsert: true }
            );
            total++;
        }
    }
    return total;
};

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

    // Cuentas del personal del salón para la app de comandas (opcionales).
    // Nunca se pisa la contraseña de una cuenta que ya existe.
    for (const [rol, prefijo] of [["mesero", "MESERO"], ["cocina", "COCINA"]]) {
        const correo = process.env[`${prefijo}_CORREO`]?.toLowerCase().trim();
        const password = process.env[`${prefijo}_PASSWORD`];
        if (!correo || !password) continue;
        if (await User.exists({ correo })) {
            console.log(`Cuenta de ${rol} ya existe: ${correo}`);
        } else {
            await User.create({ nombre: rol === "mesero" ? "Mesero" : "Cocina", correo, password, rol_id: rol });
            console.log(`Cuenta de ${rol} creada: ${correo}`);
        }
    }

    const totalProductos = await sembrarMenu();
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

    // Mesas del salón: solo si todavía no hay ninguna (las 9 y 10 son de 6).
    if (!(await Mesa.exists({}))) {
        await Mesa.insertMany(
            Array.from({ length: 10 }, (_, i) => ({ numero: i + 1, capacidad: i >= 8 ? 6 : 4 }))
        );
        console.log("Mesas: 10 creadas");
    }

    // Campos nuevos de la migración de comandas, para documentos anteriores.
    await MenuItem.updateMany({ visible_web: { $exists: false } }, { $set: { visible_web: true } });
    await MenuItem.updateMany({ visible_salon: { $exists: false } }, { $set: { visible_salon: true } });
    await User.updateMany({ activo: { $exists: false } }, { $set: { activo: true } });

    // Índices que falten (únicos parciales de comandas y caja). No borra ninguno.
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));

    await mongoose.disconnect();
};

module.exports = { sembrarMenu };

if (require.main === module) {
    require("dotenv").config();
    seed().catch(async (error) => {
        console.error("Error en el seed:", error);
        await mongoose.disconnect();
        process.exit(1);
    });
}
