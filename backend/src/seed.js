// Carga datos iniciales: roles, usuario admin, categorías, productos de ejemplo
// e intenciones del chatbot.
// Se puede ejecutar varias veces sin duplicar nada: npm run seed
const dotenv = require("dotenv");

dotenv.config();

const mongoose = require("mongoose");
const connectDB = require("./config/database");
const { Role, User, Category, MenuItem, ChatIntent } = require("./models");
const INTENCIONES = require("./data/intenciones");

const ROLES = [
    { _id: "admin", nombre: "Administrador" },
    { _id: "cliente", nombre: "Cliente" },
];

const MENU = {
    "Bebidas calientes": [
        { tipo: "bebida", nombre: "Café americano", precio: 6000, descripcion: "Café de origen recién molido" },
        { tipo: "bebida", nombre: "Capuchino", precio: 8500, descripcion: "Espresso con leche espumada" },
        { tipo: "bebida", nombre: "Chocolate caliente", precio: 7500, descripcion: "Con queso opcional" },
    ],
    "Bebidas frías": [
        { tipo: "bebida", nombre: "Jugo de naranja", precio: 7000, descripcion: "Natural, recién exprimido" },
        { tipo: "bebida", nombre: "Limonada de coco", precio: 9000 },
    ],
    "Platos fuertes": [
        { tipo: "plato", nombre: "Huevos benedictinos", precio: 24000, descripcion: "Pan inglés, jamón, huevo pochado y salsa holandesa" },
        { tipo: "plato", nombre: "Pancakes con frutos rojos", precio: 19000, descripcion: "Con miel de maple y crema" },
        { tipo: "plato", nombre: "Tostada de aguacate", precio: 18000, descripcion: "Pan de masa madre, aguacate y huevo" },
    ],
    Postres: [
        { tipo: "postre", nombre: "Waffle con helado", precio: 15000 },
        { tipo: "postre", nombre: "Croissant de almendras", precio: 9500 },
    ],
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

    let totalProductos = 0;
    for (const [nombreCategoria, productos] of Object.entries(MENU)) {
        const categoria = await Category.findOneAndUpdate(
            { nombre: nombreCategoria },
            { nombre: nombreCategoria },
            { upsert: true, returnDocument: "after" }
        );

        for (const producto of productos) {
            await MenuItem.updateOne(
                { nombre: producto.nombre },
                { ...producto, categoria_id: categoria._id },
                { upsert: true }
            );
            totalProductos++;
        }
    }
    console.log(`Categorías: ${Object.keys(MENU).length}, productos: ${totalProductos}`);

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
