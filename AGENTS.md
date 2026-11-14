# Contexto para asistentes de código

Este archivo es para asistentes de IA (Claude Code, Codex, Cursor, Copilot, Gemini…) que trabajen en este repo. Las personas deben empezar por el [README.md](README.md).

## Qué es

Brunch & Co. es la web de un restaurante de brunch en Neiva (Colombia). Es un proyecto de equipo con tres aplicaciones en un mismo repo:

| Carpeta | Qué es | Stack | Puerto |
|---|---|---|---|
| [backend/](backend/) | API REST y WebSocket | Node ≥ 20.19, Express 5, Mongoose 9, zod, ws, JWT | 3000 |
| [frontend/](frontend/) | Web de clientes y panel de admin (`/admin`) | React 19, Vite 8, Bulma, GSAP, lucide-react | 5173 |
| [personal/](personal/) | App del personal: mesero, cocina y administración | React 19, Vite 6, Tailwind 4 | 5174 |

No hay TypeScript. Todo es JavaScript (CommonJS en el backend y ES modules en los frontends).

## Reglas que no se negocian

1. **La base de datos es compartida.** Todo el equipo usa el mismo MongoDB Atlas, también en desarrollo. Hay datos reales.
   - No escribas en la base sin que la persona lo pida: nada de `npm run seed`, crear pedidos ni borrar documentos.
   - Lo que se cree para probar lleva la etiqueta e2e: correos `@e2e.brunch.test`, mesas con número 900 o mayor, y nombres que empiezan por `[E2E]`.
   - Para limpiar: `cd backend && npm run e2e:limpiar` (solo cuenta) y `npm run e2e:limpiar -- --confirmar` (borra solo lo etiquetado).
   - Para probar pantallas con sesión sin tocar la base, simula las respuestas de la API (por ejemplo con `page.route` de Playwright).
2. **Los `.env` tienen secretos.** Están en `.gitignore`. No los subas, no los copies en documentación y no los pegues en servicios externos.
3. **Todo en español.** Variables, funciones, comentarios, textos de la interfaz, mensajes de error y commits. Los modelos de Mongoose usan nombres en inglés (`Order`, `MenuItem`), pero sus campos están en español (`estado`, `precio`, `categoria_id`).
4. **Los comentarios explican el porqué**, no el qué. Al editar un archivo, conserva los comentarios que ya tiene.

## Cómo ejecutar y verificar

```bash
cd backend  && npm install && npm run dev    # necesita backend/.env (MONGO_URI, JWT_SECRET)
cd frontend && npm install && npm run dev
cd personal && npm install && npm run dev
```

Antes de dar un cambio por terminado:

```bash
cd backend  && npm test && npm run lint      # MongoDB en memoria, no toca Atlas
cd frontend && npx eslint . && npm run build
cd personal && npm run lint && npm run build
```

- La primera vez, `npm test` descarga MongoDB (~1,3 GB). Si `npm install` del backend se hace con `MONGOMS_DISABLE_POSTINSTALL=1`, esa descarga ocurre en el primer `npm test`.
- Los cambios de interfaz se revisan en el navegador, en escritorio (1280 px) y en celular (390 px). Revisa también que no haya scroll horizontal.

## Backend

Recorrido de una petición: `routes/` → middleware → `controllers/` → `services/` → `models/`.

- **Rutas:** [routes/index.js](backend/src/routes/index.js) monta todo bajo `/api`. Las rutas de la app del personal están en `routes/salon.js` y `routes/admin/`.
- **Autenticación y roles:** `auth`, `authOpcional`, `requireRole(ROL.ADMIN)` y `verificarDueno` están en [middleware/auth.js](backend/src/middleware/auth.js). Usa las constantes `ROL.*` de [utils/roles.js](backend/src/utils/roles.js), nunca textos sueltos. Los roles son `cliente`, `admin`, `mesero` y `cocina`.
- **Errores:** lanza `new HttpError(status, mensaje)` de [utils/http.js](backend/src/utils/http.js). Express 5 captura los errores de funciones `async` sin envoltorios.
  - Las rutas de la web responden `{ mensaje, errores? }` en JSON.
  - Las rutas del personal responden el mismo mensaje en **texto plano**.
- **Validación:** usa zod con los ayudantes de [utils/validar.js](backend/src/utils/validar.js) (`validar`, `objectId`, `texto`, `dinero`…).
- **Auditoría:** las acciones de admin se registran con el middleware `auditar(SERVICIO.X, "ACCION", describir)` en la ruta.
- **Contrato con la app del personal:** sus respuestas pasan por [utils/serializar.js](backend/src/utils/serializar.js). Usan camelCase, ids como texto, roles en mayúscula (`ADMIN`, `MESERO`, `COCINA`, `USUARIO`) y fechas en hora de Bogotá sin `Z`.
- **Hora:** las fechas de negocio se calculan con [utils/tiempo.js](backend/src/utils/tiempo.js) en `ZONA_HORARIA` (America/Bogota). No uses `new Date()` a secas para decidir "hoy".
- **Dinero:** usa [utils/dinero.js](backend/src/utils/dinero.js). Los precios y totales se calculan en el servidor, nunca se aceptan del cliente.
- **Transacciones:** enviar a cocina, cancelar y cobrar usan `conTransaccion` ([utils/transaccion.js](backend/src/utils/transaccion.js)). Necesitan un replica set: Atlas lo es, un MongoDB local suelto no.
- **Estados con reglas:**
  - Pedidos: `Order.TRANSICIONES`, `pendiente → confirmado → preparando → en_camino → entregado` (o `cancelado`).
  - Reservas: `pendiente → confirmada → finalizada` (o `cancelada`). Solo en horario de atención y con un máximo de 30 personas por horario.
  - Los cambios de estado son condicionales: si dos peticiones chocan, una recibe 409.
- **Tiempo real:** el WebSocket está en `/ws` ([ws/](backend/src/ws/)). Usa temas como `/topic/salon` y `/topic/cocina`. Las suscripciones viven en memoria, así que el backend corre en **una sola instancia**.
- **Chatbot:** [services/chatbot.js](backend/src/services/chatbot.js) y [controllers/chatController.js](backend/src/controllers/chatController.js). Detecta intenciones por palabras clave guardadas en la base (`ChatIntent`); las iniciales están en `data/intenciones.js`. Con sesión puede crear, editar y cancelar reservas. Sin sesión responde, pero no guarda la conversación.
- **Pruebas:** `node:test` + `supertest` en [backend/tests/](backend/tests/), con un MongoDB en memoria por archivo. Los ayudantes están en `tests/helpers.js`.

La lista completa de endpoints está en [backend/README.md](backend/README.md). Si cambias un endpoint, actualiza esa tabla.

## Frontend (web de clientes)

- **Tema:** los colores, las fuentes y las piezas compartidas viven en [frontend/src/index.css](frontend/src/index.css).
  - Variables: `--espresso`, `--crema`, `--mantequilla`, `--caramelo`, `--yema`, `--tinta`, `--linea`…
  - Fuentes: Fraunces para títulos y Figtree para textos y botones.
  - Clases: `.contenedor`, `.titulo-seccion`, `.bajada`, `.boton` (`--primario`, `--secundario`, `--crema`, `--contorno-claro`, `--ancho`, `--chico`), `.campo`, `.fila-campos`, `.aviso` (`--error`, `--ok`), `.tarjeta`, `.esqueleto` y `.entrada-pagina`.
  - Usa estas variables y clases en vez de colores o botones nuevos.
- **Bulma** se importa en `main.jsx` antes de `index.css`, para que el tema mande. Se usa poco: el navbar y algunas utilidades.
- **Estilos:** cada componente tiene su `.css` al lado, con clases en español y prefijo propio (`fav-`, `cart-`, `perfil-`…).
- **Datos del local:** dirección, teléfono y horario están en [utils/horario.js](frontend/src/utils/horario.js). Se usan en el inicio, el mapa, el contacto y el pie.
- **API:** todo pasa por [api/api.js](frontend/src/api/api.js) y los archivos de `services/`. El token se guarda en `localStorage` (`brunch_token`) y el carrito también (`brunch_carrito`).
- **Estado global:** `AuthContext` (usuario) y `CartContext` (carrito y panel abierto o cerrado).
- **Perfil:** la lógica está en el hook [usePerfilUsuario.js](frontend/src/hooks/usePerfilUsuario.js) y la vista en `components/perfil/`. Ahí el cliente edita y cancela sus reservas pendientes o confirmadas (`PATCH /reservas/:id` y `PATCH /reservas/:id/cancelar`). Los cambios vuelven del backend y reemplazan la fila en la lista.
- **Páginas:** cada página monta su propio `Navbar`.
  - `sobreFoto`: la página empieza con foto o video; el navbar va en blanco.
  - `alRas`: la página dibuja su propio fondo bajo el navbar, sin espaciador.
  - Las portadas con video de Menú y Contacto usan `components/PortadaPagina.jsx`.
- **Animación:** GSAP se usa en la portada, el carrusel de favoritos (`Favorites.jsx`), el pan que cae (`SandwichFalling.jsx`) y la entrada de las tarjetas del menú. Respeta siempre `prefers-reduced-motion`. En desarrollo React monta los efectos dos veces (StrictMode): las animaciones deben limpiar lo suyo y no depender del estado que dejó el montaje anterior.
- **Panel de admin** (`pages/admin/`): tiene su propio estilo en `admin.css` ("la libreta del encargado"). El botón "Abrir comandas" abre la app del personal en `/entrar#token=…`.
- **Textos de la interfaz:** frases cortas en tono cálido y cercano. Botones con verbos que dicen lo que pasa ("Reservar mesa", "Ir a pagar"). Sin MAYÚSCULAS sostenidas.

## App del personal

- **Tema:** Tailwind 4, con el tema en el bloque `@theme` de [personal/src/index.css](personal/src/index.css). Comparte el espresso y la crema de la web, con la fuente Archivo. Los nombres `rio` y `rio-hondo` se conservaron por compatibilidad, pero son el espresso de marca. El foco de los campos usa `caramelo`. Los colores de estado (`espera`, `tibio`, `brasa`, `listo`) indican cuánto lleva esperando algo.
- **Conexión con el backend:** Vite hace de proxy de `/api` y `/ws` hacia el backend (`API_TARGET`, por defecto `http://localhost:3000`). Por eso no hay CORS en desarrollo.
- **Inicio por rol:** cada rol entra a una pantalla distinta (`INICIO_POR_ROL` en `lib/formato.js`). Mesero va a `/mesas`, cocina a `/cocina` y admin a `/admin`.
- **Avisos en vivo:** llegan por WebSocket con `hooks/useWebSocket.js`.
- **Código de cierre del WebSocket:** con 4401 (la sesión ya no vale) o 4403 (cambió el rol), la app no reconecta y pide volver a entrar.

## Navegar el código con CodeGraph

El repo puede estar indexado con [CodeGraph](https://github.com/colbymchenry/codegraph). Si existe la carpeta `.codegraph/` en la raíz, úsalo antes de grep o de abrir archivos:

```bash
codegraph explore "cómo se crea un pedido y su pago"   # símbolos, código y quién los llama
codegraph status                                       # estado del índice
```

En Claude Code está disponible como herramienta MCP (`codegraph_explore`). El índice es local a cada máquina, no se sube a git y se actualiza solo mientras corre el servidor MCP. Si no existe `.codegraph/`, ignora esta sección.

## Problemas conocidos

- **Login con Google:** falla en `localhost:5173` hasta que alguien agregue ese origen al cliente OAuth en Google Cloud Console.
- **Descripciones de platos:** algunas están cruzadas en la base. Por ejemplo, el Latte habla de champaña y el Smoothie de matcha. Se corrigen desde Administración → Menú, no en código.
- **Clima:** la clave de OpenWeather está escrita en `WeatherBadge.jsx` y `WeatherRecommendation.jsx`.
- **Datos de ejemplo:** la dirección y el teléfono del local son de relleno ("Calle del Sabor 123").
- **Saltos de línea:** en Windows, git avisa de LF/CRLF. Es normal.
