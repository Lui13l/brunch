# Brunch & Co.

Web de un restaurante de brunch: menú, carrito y pedidos a domicilio, reservas de mesa y un asistente virtual.

| Carpeta | Qué es |
|---|---|
| [backend/](backend/) | API REST con Express + MongoDB. Ver [backend/README.md](backend/README.md) para los endpoints |
| [frontend/](frontend/) | Web con React + Vite + Bulma + GSAP |
| [personal/](personal/) | App del personal (mesero, cocina y administración): comandas, caja, inventario. React + Vite + Tailwind |

## Cómo ejecutarlo

Necesitas **Node.js 20.19 o superior** (el archivo `.nvmrc` indica la versión 22; con nvm basta `nvm use`). La base de datos es la de **MongoDB Atlas** compartida por el equipo: pide la `MONGO_URI` y no instales nada más.

**1. Backend** (terminal 1)

```bash
cd backend
npm install
cp .env.example .env   # completa MONGO_URI y JWT_SECRET
npm run seed           # carga el menú, el admin y el chatbot
npm run dev            # http://localhost:3000
```

**2. Frontend** (terminal 2)

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

**3. App del personal** (terminal 3, opcional): mesero, cocina y administración

```bash
cd personal
npm install
npm run dev            # http://localhost:5174 (también desde el celular en la misma red)
```

Entra con una cuenta de admin, mesero o cocina. El admin crea las cuentas del personal desde **Administración → Personal**, y también puede crearlas `npm run seed` con `MESERO_*` y `COCINA_*` en `backend/.env`. Para usarla desde el celular, agrega `http://<IP-de-tu-PC>:5174` a `WS_ORIGINS` en `backend/.env`. Todo usa la misma base de Atlas: no hace falta instalar nada más.

El frontend usa `http://localhost:3000/api` por defecto. Para otra dirección, crea `frontend/.env` a partir de [frontend/.env.example](frontend/.env.example).

Para habilitar el login con Google, crea un cliente OAuth 2.0 de tipo aplicación web en Google Cloud, agrega el origen del frontend como origen autorizado y configura el mismo `GOOGLE_CLIENT_ID` en `backend/.env` y `VITE_GOOGLE_CLIENT_ID` en `frontend/.env`.

## Pruebas del backend

```bash
cd backend
npm test
```

Las pruebas **no tocan la base compartida**: levantan un MongoDB temporal en memoria. La primera vez que se ejecutan en un PC, `mongodb-memory-server` descarga el binario de MongoDB (unos 1,3 GB, una sola vez; queda en la caché del usuario), así que esa primera corrida tarda varios minutos. Las siguientes son rápidas.

## Qué hace cada página

| Página | Qué hace | Necesita sesión |
|---|---|---|
| Inicio, Nosotros | Contenido del restaurante | No |
| Menú | Productos de la base de datos; se agregan al carrito | No |
| Carrito → Pagar | Crea el pedido y el pago en el backend | Sí |
| Reservar | Crea una reserva | Sí |
| Contacto | Chat con el asistente. Con sesión también responde sobre tus pedidos y reservas | No |
| Ingresar | Login y registro | — |

El seed crea el usuario admin `admin@brunch.com` / `admin123` (cámbialo en producción). Los clientes se registran desde la web.

## Imágenes del menú

Las fotos de los productos están en [frontend/public/menu/](frontend/public/menu/) y cada producto guarda su ruta en `img_url` (por ejemplo `/menu/pancakes.jpg`). Para añadir un producto con foto, copia la imagen ahí y créalo con esa ruta.
