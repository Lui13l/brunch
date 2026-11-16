# Contexto para asistentes de código

Este archivo es para asistentes de IA (Claude Code, Codex, Cursor, Copilot, Gemini…) que trabajen en este repo. Las personas deben empezar por el [README.md](README.md).

## Trabajo en curso

Si existe [HANDOVER.md](HANDOVER.md) en la raíz, léelo primero: dice qué está hecho, qué sigue y qué decisiones ya se tomaron. Actualízalo antes de que termine tu sesión (por límite de tokens o de tiempo) y al cerrar cada fase, para que quien siga no tenga que reconstruir el contexto.

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
- **Autenticación y roles:** `auth`, `authOpcional`, `requireRole(ROL.ADMIN)` y `verificarDueno` están en [middleware/auth.js](backend/src/middleware/auth.js). Usa las constantes `ROL.*` de [utils/roles.js](backend/src/utils/roles.js), nunca textos sueltos. Los roles son `cliente`, `admin`, `mesero` y `cocina`. Solo hay un administrador: `cambiarCuenta` ([services/cuentas.js](backend/src/services/cuentas.js)) responde 409 si se le da ese rol a otra cuenta, y las pantallas no lo ofrecen.
- **Errores:** lanza `new HttpError(status, mensaje)` de [utils/http.js](backend/src/utils/http.js). Express 5 captura los errores de funciones `async` sin envoltorios.
  - Las rutas de la web responden `{ mensaje, errores? }` en JSON.
  - Las rutas del personal responden el mismo mensaje en **texto plano**.
- **Validación:** usa zod con los ayudantes de [utils/validar.js](backend/src/utils/validar.js) (`validar`, `objectId`, `texto`, `dinero`…).
- **Auditoría:** las acciones de admin se registran con el middleware `auditar(SERVICIO.X, "ACCION", describir)` en la ruta.
- **Contrato con la app del personal:** sus respuestas pasan por [utils/serializar.js](backend/src/utils/serializar.js). Usan camelCase, ids como texto, roles en mayúscula (`ADMIN`, `MESERO`, `COCINA`, `USUARIO`) y fechas en hora de Bogotá sin `Z`.
- **Hora:** las fechas de negocio se calculan con [utils/tiempo.js](backend/src/utils/tiempo.js) en `ZONA_HORARIA` (America/Bogota). No uses `new Date()` a secas para decidir "hoy".
- **Dinero:** usa [utils/dinero.js](backend/src/utils/dinero.js). Los precios y totales se calculan en el servidor, nunca se aceptan del cliente.
- **Inventario por receta:** `consumirPorReceta` y `devolverConsumosDe` ([services/inventario.js](backend/src/services/inventario.js)) sirven a las mesas y a los pedidos web. Después de cada movimiento se llama `avisarInventario()` fuera de la transacción.
- **Pedidos web en cocina:** [services/cocinaWeb.js](backend/src/services/cocinaWeb.js). Entran al confirmarse, desde `aplicarEstado` en `services/pedidos.js`. `enviado_cocina_en` es el candado para no enviarlos dos veces. La cola de cocina (`cocinaController`) une comandas y pedidos; cada plato lleva su `contenedor`.
- **Domiciliario de un pedido web:** `asignarDomiciliario` en [services/pedidos.js](backend/src/services/pedidos.js) lo asigna o lo cambia (el anterior queda disponible) y avisa por `/topic/admin/pedidos/estado`. Lo usan la web (`PATCH /api/pedidos/:id/domiciliario`) y la app de comandas (`PATCH /api/admin/pedidos/:id/domiciliario`, con `GET` y `POST /api/admin/domiciliarios`). En las dos pantallas cambiarlo es un paso aparte, y con el pedido en camino pide confirmar.
- **Mesas juntas:** una cuenta ocupa `mesa_id` más `mesas_extra`. Antes de asignar mesas se llama `reclamarMesas` (`services/comandas.js`) dentro de una transacción.
- **Caja:** el cuadre (`services/caja.js#calcularCuadre`) suma solo las cuentas de mesa y los pedidos web: un pedido web cuenta desde que se aprueba su pago (`Payment.aprobado_en`) y deja de contar si se cancela; va aparte en `ventasWeb` y `pedidosWeb`. Los movimientos manuales son para dinero que no viene de una venta; cada uno lleva `metodo` y solo el efectivo cambia lo esperado en el cajón.
- **Cuenta dividida:** al cobrar llega `metodoPago` o `pagos: [{ metodo, monto, etiqueta }]`; la suma de `pagos` debe dar el total que calcula el servidor. `metodo_pago` queda como resumen (`MIXTO` si hay varios métodos). Para saber cuánto entró por cada método usa `pagosDeComanda` ([utils/pagos.js](backend/src/utils/pagos.js)), que también entiende las cuentas antiguas sin `pagos`.
- **Plano del salón:** cada mesa tiene `forma`, `pos_x`, `pos_y` y `rotacion`. Cuántas celdas ocupa se calcula en [utils/plano.js](backend/src/utils/plano.js) y, repetido, en `personal/src/lib/plano.js`: si cambia uno, cambia el otro.
- **Transacciones:** abrir cuenta, enviar a cocina, cancelar, cobrar y confirmar o cancelar un pedido web usan `conTransaccion` ([utils/transaccion.js](backend/src/utils/transaccion.js)). Necesitan un replica set: Atlas lo es, un MongoDB local suelto no.
- **Estados con reglas:**
  - Pedidos: `Order.TRANSICIONES`, `pendiente → confirmado → preparando → en_camino → entregado` (o `cancelado`).
  - Reservas: `pendiente → confirmada → finalizada` (o `cancelada`). Solo en horario de atención y con un máximo de 30 personas por horario.
  - Los cambios de estado son condicionales: si dos peticiones chocan, una recibe 409.
- **Imágenes de platos:** se guardan en la base (`Imagen`). `POST /api/admin/imagenes` recibe el archivo como cuerpo binario (`express.raw` en esa ruta) y lee el tipo de los primeros bytes; `GET /api/imagenes/:id` es público. El plato guarda la ruta `/api/imagenes/:id` en `img_url`; al cambiarla, [services/imagenes.js](backend/src/services/imagenes.js) borra la anterior si nadie más la usa.
- **Facturas:** [services/facturas.js](backend/src/services/facturas.js). Son comprobantes en PDF (`pdfkit`) de pedidos web, no facturas ante la DIAN. `aplicarEstado` emite y envía una al pasar a `entregado` si hay un pago por transferencia aprobado; las demás se generan desde el panel (`/api/facturas`). El correo sale por Gmail (`GMAIL_USUARIO`, `GMAIL_CLAVE_APP`, SMTP con `nodemailer`) o por la API de Resend (`RESEND_API_KEY`, `CORREO_REMITENTE`); si están los dos manda Gmail, y sin ninguno queda "sin enviar". Emitir y enviar nunca tumban el cambio de estado. En las pruebas se reemplazan `nodemailer.createTransport` y `global.fetch`: nada sale a internet.
- **Tiempo real:** el WebSocket está en `/ws` ([ws/](backend/src/ws/)). Usa temas como `/topic/salon` y `/topic/cocina`. Las suscripciones viven en memoria, así que el backend corre en **una sola instancia**.
- **Chatbot:** [services/chatbot.js](backend/src/services/chatbot.js) y [controllers/chatController.js](backend/src/controllers/chatController.js). Detecta intenciones por palabras clave guardadas en la base (`ChatIntent`); las iniciales están en `data/intenciones.js`. Compara palabra por palabra, sin plurales y tolerando un error de escritura. Con sesión puede crear, editar y cancelar reservas. Sin sesión responde, pero no guarda la conversación. Las variables `{reservas_hoy}`, `{pedidos_pendientes}` y `{ventas_hoy}` solo dan datos del negocio a un admin. La charla (saludo, gracias, despedida) cede ante una pregunta de verdad en el mismo mensaje. Cada tema tiene varias respuestas y no repite la que acaba de dar. La respuesta trae `sugerencias` para mostrar como botones: las de la intención o lo que el texto pide contestar entre « ». Antes de responder "no entendí", `consultarCarta` busca en la carta lo que se pregunta ("¿venden cerveza?", "precio del latte"): dice si está y su precio, ofrece lo parecido o avisa que no se vende; el vocabulario (verbos de pregunta, comidas conocidas, sinónimos en inglés) está en `data/carta.js`. Si agregas palabras clave en `data/intenciones.js`, la base se actualiza con `npm run chat:sincronizar` (con `-- --respuestas` también respuestas y sugerencias; lo corre una persona).
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
- **Fotos de platos:** `img_url` puede ser un archivo de la web (`/menu/…`) o una subida (`/api/imagenes/…`, que vive en el backend). `listarProductos` ya las entrega con la dirección completa; en otro sitio usa `urlImagen` de [utils/imagenes.js](frontend/src/utils/imagenes.js). `reducirImagen` las achica a WebP antes de subirlas (la app del personal tiene la misma función en `lib/imagenes.js`).
- **API:** todo pasa por [api/api.js](frontend/src/api/api.js) y los archivos de `services/`. `api.subir` manda un archivo y `api.descargar` trae uno que pide sesión (el PDF de una factura). El token se guarda en `localStorage` (`brunch_token`) y el carrito también (`brunch_carrito`).
- **Estado global:** `AuthContext` (usuario), `CartContext` (carrito y panel abierto o cerrado) y `ChatContext` (la conversación con el asistente).
- **Chat:** `components/ChatBox.jsx` solo dibuja; la conversación vive en `ChatContext`, así que es la misma en la página de contacto y en el chat flotante (`components/ChatFlotante.jsx`, un botón fijo sobre el del carrito). El flotante no sale en `/contact`, `/checkout`, `/login` ni en `/admin`. La conversación se reinicia al entrar o salir de la cuenta.
- **Perfil:** la lógica está en el hook [usePerfilUsuario.js](frontend/src/hooks/usePerfilUsuario.js) y la vista en `components/perfil/`. Ahí el cliente edita y cancela sus reservas pendientes o confirmadas (`PATCH /reservas/:id` y `PATCH /reservas/:id/cancelar`). Los cambios vuelven del backend y reemplazan la fila en la lista.
- **Páginas:** cada página monta su propio `Navbar`.
  - `sobreFoto`: la página empieza con foto o video; el navbar va en blanco.
  - `alRas`: la página dibuja su propio fondo bajo el navbar, sin espaciador.
  - Las portadas con video de Menú y Contacto usan `components/PortadaPagina.jsx`.
- **Pantalla de carga:** `components/PantallaCarga.jsx` (el pancito caminando, con una sola línea de tiempo de GSAP) y `context/CargaContext.jsx`. Se usa como transición: `await cubrir("mensaje")` de `usePantallaCarga()` se cumple cuando el telón ya tapa la página, y ahí se navega; se va sola. Sale al entrar (solo si el login fue bien), al salir, al pagar, al confirmar una reserva y al abrir el panel de admin. Si ya hay una puesta, `cubrir` devuelve esa misma. La hoja del pancito tiene 8 cuadros en 4 columnas y 2 filas (`assets/pancito-sprite-set-transparente.webp`).
- **Animación:** GSAP se usa en la pantalla de carga, la portada, el carrusel de favoritos (`Favorites.jsx`), el pan que cae (`SandwichFalling.jsx`) y la entrada de las tarjetas del menú. Respeta siempre `prefers-reduced-motion`. En desarrollo React monta los efectos dos veces (StrictMode): las animaciones deben limpiar lo suyo y no depender del estado que dejó el montaje anterior.
- **Panel de admin** (`pages/admin/`): tiene su propio estilo en `admin.css` ("la libreta del encargado"). El botón "Abrir comandas" abre la app del personal en `/entrar#token=…`.
- **Textos de la interfaz:** frases cortas en tono cálido y cercano. Botones con verbos que dicen lo que pasa ("Reservar mesa", "Ir a pagar"). Sin MAYÚSCULAS sostenidas.

## App del personal

- **Tema:** Tailwind 4, con el tema en el bloque `@theme` de [personal/src/index.css](personal/src/index.css). Comparte el espresso y la crema de la web, con la fuente Archivo. Los nombres `rio` y `rio-hondo` se conservaron por compatibilidad, pero son el espresso de marca. El foco de los campos usa `caramelo`. Los colores de estado (`espera`, `tibio`, `brasa`, `listo`) indican cuánto lleva esperando algo.
- **Conexión con el backend:** Vite hace de proxy de `/api` y `/ws` hacia el backend (`API_TARGET`, por defecto `http://localhost:3000`). Por eso no hay CORS en desarrollo.
- **Inicio por rol:** cada rol entra a una pantalla distinta (`INICIO_POR_ROL` en `lib/formato.js`). Mesero va a `/mesas`, cocina a `/cocina` y admin a `/admin`.
- **Avisos en vivo:** llegan por WebSocket con `hooks/useWebSocket.js`. Algunos mensajes de `/topic/salon` solo llevan `tipo` (`carta`, `mesas`, `mesaCompleta`): cada pantalla ignora los que no le sirven.
- **Sesión:** `context/AuthContext.jsx` confirma la sesión guardada con `GET /api/usuarios/yo` al abrir, al volver a la pestaña y cada 5 minutos. Mientras `verificando` es true, `RutaProtegida` no pinta la pantalla.
- **Pantalla de carga:** el mismo pancito de la web, en `components/PantallaCarga.jsx` y `context/CargaContext.jsx` (el hook `usePantallaCarga` está en `context/carga.js`). Aquí se mueve solo con CSS (clases `carga-*` de `index.css`), sin GSAP. Sale al entrar con correo, al llegar desde el panel de la web (`/entrar`) y al abrir la app con una sesión guardada. Los tiempos del telón están en `index.css` y, repetidos, en `CargaContext.jsx`.
- **Comandas:** `pages/Comanda.jsx` tiene tres vistas (cuenta, carta, cobro); la carta, el cobro y la hoja de mesas están en `components/comanda/`. En la carta cada plato lleva su contador (menos, cantidad, más): pedir otra vez el mismo plato sube la cantidad del renglón que está por enviar, no crea otro. Un plato agotado no se puede agregar ni sumar; sí se puede quitar.
- **Dividir la cuenta:** `components/comanda/Division.jsx` solo dibuja; el reparto (partes iguales o por platos) se calcula en `lib/division.js#repartir` y el estado vive en `Cobro.jsx`. El servidor vuelve a sumar los pagos.
- **Plano del salón:** `components/PlanoSalon.jsx` y `MesaIlustracion.jsx` (SVG según forma y capacidad). El admin lo arma arrastrando en Mesas (dentro del plano o desde la lista «Sin ubicar», con una silueta que marca dónde cae); el mesero lo ve de solo lectura.
- **Gráficas:** `components/Barras.jsx`, sin librerías: `BarrasHorizontales` para comparar categorías y `SerieTiempo` para las ventas en el tiempo (puntos unidos por una línea). Lo que se mira va en `caramelo`; solo el periodo comparado usa otro color (`comparado`, validado con el caramelo para daltonismo) y además va punteado. El texto nunca lleva el color de la marca. Las cuentas del análisis (periodo comparado, acumulado, media móvil, variación) están en `lib/series.js`.
- **Hover y cursor:** se definen una vez en `index.css`: todo lo pulsable lleva la mano y, al pasar el mouse, un velo del color de su texto. Sin aros, sombras ni saltos; `data-sin-hover` lo apaga.
- **ESLint** no ve el uso de un componente desestructurado en un `map` (`({ Icono }) => <Icono />`): usa `opcion.Icono`.
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
