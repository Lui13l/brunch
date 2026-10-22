# Brunch & Co.

Web de un restaurante de brunch: menú, carrito y pedidos a domicilio, reservas de mesa y un asistente virtual.

| Carpeta | Qué es |
|---|---|
| [backend/](backend/) | API REST con Express + MongoDB. Ver [backend/README.md](backend/README.md) para los endpoints |
| [frontend/](frontend/) | Web con React + Vite + Bulma + GSAP |

## Cómo ejecutarlo

Necesitas Node.js 20 o superior y una base de datos MongoDB (local o Atlas).

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

El frontend usa `http://localhost:3000/api` por defecto. Para otra dirección, crea `frontend/.env` a partir de [frontend/.env.example](frontend/.env.example).

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
