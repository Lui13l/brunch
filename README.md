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

## Comprobar que todo funciona

### 1. Pruebas automáticas (unos 5 minutos)

```bash
cd backend  && npm test                      # deben pasar todas
cd frontend && npx eslint . && npm run build # sin errores
cd personal && npm run lint && npm run build # sin errores
```

### 2. Recorrido manual (unos 15 minutos)

Levanta los tres proyectos (ver [Cómo ejecutarlo](#cómo-ejecutarlo)). Para ver el tiempo real entre roles, usa **dos navegadores**, o una ventana normal y otra de incógnito, porque cada uno guarda su propia sesión.

> **La base es compartida por todo el equipo.** Todo lo que crees para probar debe llevar la etiqueta e2e, para borrarlo después sin tocar datos reales:
> - correos que terminen en `@e2e.brunch.test`
> - mesas con número 900 o mayor
> - nombres que empiecen por `[E2E]`: platos, insumos, categorías, domiciliarios e intenciones del chatbot
>
> No borres ni edites datos que no hayas creado tú.

**Web (http://localhost:5173)**
1. Navega por Inicio, Menú, Nosotros y Contacto. El navbar es transparente:
   - Arriba es blanco sobre las fotos y café sobre los fondos crema.
   - Al bajar se vuelve crema.
2. Regístrate con un correo `@e2e.brunch.test`, agrega un plato al carrito, paga y haz una reserva.
3. En **Perfil**, cambia tu nombre y guarda.

**Panel de admin (http://localhost:5173/admin, con una cuenta admin)**
1. **Categorías:** crea `[E2E] Prueba`.
2. **Menú:** crea `[E2E] Plato` en esa categoría y edita su precio. Si desmarcas "Visible en la web", no aparece en la carta pública.
3. **Pedidos:** el pedido del paso 2 de la web aparece en *Activos*. Confírmalo y asígnale un domiciliario (crea antes `[E2E] Domiciliario` en **Domiciliarios**).
4. **Pagos:** aprueba el pago. **Reservas:** confirma la reserva.
5. **Usuarios y roles:** desactiva y reactiva tu cuenta de cliente e2e. Al desactivarla, su sesión se cierra.
6. **Chatbot:** crea `[E2E] Intención` con una palabra clave rara y prueba esa palabra en el chat de Contacto.
7. **Auditoría:** cada una de esas acciones aparece con tu nombre.
8. **Abrir comandas:** se abre la app del personal (5174) con tu sesión de admin ya iniciada.

**App del personal (http://localhost:5174)**
1. Como admin, en **Personal**, crea un mesero y una cocina con correos `@e2e.brunch.test`. En **Mesas**, crea la mesa 900. En **Insumos**, crea `[E2E] Harina` con stock 100. En **Recetas**, asígnala a `[E2E] Plato`.
2. **Navegador A, mesero:** abre la mesa 900, agrega `[E2E] Plato` y envíalo a cocina.
3. **Navegador B, cocina:** el plato llega solo, con sonido. Márcalo *Empezar* y luego *Listo*.
4. **Navegador A:** aparece el aviso "Mesa 900 completa". Entrega el plato y cobra.
5. Como admin:
   - En **Caja**, si no hay una caja abierta de verdad, ábrela, cobra y ciérrala. Si alguien del restaurante tiene una caja abierta, sáltate este paso.
   - **Reportes** muestra la venta y el consumo de harina.
   - Si desactivas al mesero en **Personal**, su sesión se cierra al instante.

### 3. Limpiar lo que creaste

```bash
cd backend
npm run e2e:limpiar                # muestra cuánto borraría (no borra nada)
npm run e2e:limpiar -- --confirmar # borra solo los datos con etiqueta e2e
npm run e2e:limpiar                # comprueba que todo quedó en 0
```

### Problemas comunes

| Síntoma | Solución |
|---|---|
| La app del personal carga, pero no llegan los avisos en vivo desde el celular | Agrega `http://<IP-de-tu-PC>:5174` a `WS_ORIGINS` en `backend/.env` y reinicia el backend |
| "Abrir comandas" no abre la app | La app del personal debe estar corriendo. Si no está en `http://localhost:5174`, define `VITE_PERSONAL_URL` en `frontend/.env` |
| El botón de Google dice que el origen no está permitido | En Google Cloud Console → Credenciales → tu cliente OAuth, agrega `http://localhost:5173` a los orígenes autorizados |
| `npm test` tarda mucho la primera vez | Está descargando MongoDB (~1,3 GB, una sola vez) |
| Error al enviar a cocina o al cobrar con un MongoDB local | Esas operaciones usan transacciones: hace falta Atlas, o un MongoDB local configurado como replica set |
| Cambiaste algo en `.env` y no se nota | Reinicia el servidor. Vite solo lee `.env` al arrancar |

## Qué hace cada página

| Página | Qué hace | Necesita sesión |
|---|---|---|
| Inicio, Nosotros | Contenido del restaurante | No |
| Menú | Productos de la base de datos; se agregan al carrito | No |
| Carrito → Pagar | Crea el pedido y el pago en el backend | Sí |
| Reservar | Crea una reserva | Sí |
| Contacto | Chat con el asistente. Con sesión también responde sobre tus pedidos y reservas | No |
| Ingresar | Login y registro | — |
| Administración (`/admin`) | Panel del admin. Desde aquí se gestionan pedidos, menú, categorías, reservas, pagos, domiciliarios, usuarios y roles, chatbot y auditoría. El botón **Abrir comandas** abre la app del personal con la sesión ya iniciada | Solo admin |

El seed crea el usuario admin `admin@brunch.com` / `admin123` (cámbialo en producción). Los clientes se registran desde la web.

## Imágenes del menú

Las fotos de los productos están en [frontend/public/menu/](frontend/public/menu/) y cada producto guarda su ruta en `img_url` (por ejemplo `/menu/pancakes.jpg`). Para añadir un producto con foto, copia la imagen ahí y créalo con esa ruta.
