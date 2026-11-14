# Brunch & Co.

Web de un restaurante de brunch: menú, carrito y pedidos a domicilio, reservas de mesa y un asistente virtual.

| Carpeta | Qué es |
|---|---|
| [backend/](backend/) | API REST con Express + MongoDB. Ver [backend/README.md](backend/README.md) para los endpoints |
| [frontend/](frontend/) | Web de clientes y panel de admin. React + Vite + Bulma + GSAP. Los colores, fuentes y botones compartidos están en [src/index.css](frontend/src/index.css) |
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
   - Al bajar se vuelve crema. La página actual queda subrayada.
2. En **Inicio**:
   - La portada dice si el local está abierto ahora, con el clima de Neiva y la dirección.
   - En "Los favoritos de la casa" el carrusel gira solo y se detiene al pasar el mouse. Las flechas lo mueven de a un plato. Al tocar un plato se voltea y muestra su precio y descripción.
3. En **Menú**:
   - La barra de categorías queda fija al bajar y marca la sección que estás viendo. Al tocar una categoría, la página baja hasta ella.
   - El botón **+** de cada tarjeta agrega el plato sin voltearla.
   - El carrito se abre a la derecha y se cierra con Escape o tocando fuera.
4. Regístrate con un correo `@e2e.brunch.test`, agrega un plato al carrito, paga y haz una reserva.
5. En **Contacto**, toca una de las preguntas sugeridas del chat. Con sesión iniciada, escribe "Quiero hacer una reserva": el asistente pide fecha, hora y personas, y guarda la reserva como pendiente.
6. En **Perfil**:
   - Cambia tu nombre y guarda.
   - En **Pedidos**, abre el detalle de tu pedido.
   - En **Reservas**, cada reserva muestra su estado con color. Las pendientes y confirmadas tienen **Editar** (día, hora y personas) y **Cancelar** (pide confirmación). La reserva hecha desde el chat también aparece aquí.
7. Revisa al menos una página en tamaño celular (en el navegador, F12 → modo dispositivo). El menú se abre con el botón de tres rayas y no debe haber scroll horizontal.

**Panel de admin (http://localhost:5173/admin, con una cuenta admin)**
1. **Categorías:** crea `[E2E] Prueba`.
2. **Menú:** crea `[E2E] Plato` en esa categoría y edita su precio. Si desmarcas "Visible en la web", no aparece en la carta pública.
3. **Pedidos:** el pedido del paso 4 de la web aparece en *Activos*. Confírmalo y asígnale un domiciliario (crea antes `[E2E] Domiciliario` en **Domiciliarios**).
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
| Inicio | Portada con horario de hoy y clima, razones para venir, favoritos de la carta y mapa | No |
| Nosotros | Historia, valores y fotos del local | No |
| Menú | Productos de la base de datos por categoría, con una sugerencia según el clima. Se agregan al carrito | No |
| Carrito → Pagar | Crea el pedido y el pago en el backend | Sí |
| Reservar | Crea una reserva | Sí |
| Contacto | Datos del local y chat con el asistente. Con sesión también responde sobre tus pedidos y puede crear, cambiar o cancelar reservas | No |
| Perfil | Datos de la cuenta, historial de pedidos y reservas. Las reservas pendientes o confirmadas se pueden editar o cancelar | Sí |
| Ingresar | Login y registro | — |
| Administración (`/admin`) | Panel del admin. Desde aquí se gestionan pedidos, menú, categorías, reservas, pagos, domiciliarios, usuarios y roles, chatbot y auditoría. El botón **Abrir comandas** abre la app del personal con la sesión ya iniciada | Solo admin |

El seed crea el usuario admin `admin@brunch.com` / `admin123` (cámbialo en producción). Los clientes se registran desde la web.

## Imágenes del menú

Las fotos de los productos están en [frontend/public/menu/](frontend/public/menu/) y cada producto guarda su ruta en `img_url` (por ejemplo `/menu/pancakes.jpg`). Para añadir un producto con foto, copia la imagen ahí y créalo con esa ruta.

## Datos del local

La dirección, el teléfono y el horario que muestra la web están en [frontend/src/utils/horario.js](frontend/src/utils/horario.js). El inicio, el mapa, el contacto y el pie de página los leen de ahí. Si cambia el horario, actualízalo también en el backend ([backend/src/utils/horarioReservas.js](backend/src/utils/horarioReservas.js)), que es el que valida las reservas.

## Asistentes de código

[AGENTS.md](AGENTS.md) tiene el contexto del proyecto para asistentes de IA (Claude Code, Codex, Cursor, Copilot…): arquitectura, convenciones y reglas de la base compartida. Si cambias algo de eso, actualízalo también.

Opcional: [CodeGraph](https://github.com/colbymchenry/codegraph) indexa el código para que el asistente encuentre funciones y llamadas sin leer archivo por archivo. Se instala una vez por computador:

```bash
npm i -g @colbymchenry/codegraph
codegraph install --target=claude --location=global --yes   # conecta Claude Code
cd brunch && codegraph init --yes                            # indexa este repo
```

En Windows, ejecuta `codegraph` desde PowerShell la primera vez: desde Git Bash falla la descarga ("tar exited 128"). El índice queda en `.codegraph/` y no se sube a git. Reinicia Claude Code después de instalarlo.

Mientras Claude Code está abierto, el índice se actualiza solo cuando cambian los archivos. Después de un `git pull` con Claude Code cerrado, o si las respuestas parecen viejas:

| Comando | Para qué |
|---|---|
| `codegraph status` | Ver si el índice está al día ("Index is up to date") |
| `codegraph sync` | Indexar solo lo que cambió (segundos) |
| `codegraph index` | Rehacer el índice desde cero, si algo quedó raro |
| `codegraph upgrade` | Actualizar CodeGraph a la última versión |
| `codegraph unlock` | Quitar un bloqueo viejo si `sync` dice que el índice está bloqueado |
