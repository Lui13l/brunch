# Handover: segunda ronda de mejoras

Relevo de trabajo entre sesiones y entre asistentes (cualquier modelo). Lee esto **antes** de explorar el repo: dice qué está hecho, qué sigue y qué no hay que volver a averiguar. El contexto general del proyecto está en [AGENTS.md](AGENTS.md).

**Última actualización:** 2026-11-16. Las 7 fases y las rondas tercera y cuarta están en `main`. La quinta ronda (ver "Quinta ronda") está escrita, probada (235 de 235 pruebas del backend, lint y build de las tres apps) y revisada en pantalla a 1280 y 390 px con la API simulada, y quedó en un commit en `main` el 2026-11-16 (sin subir a GitHub). Falta lo que depende de la persona: ver "Qué sigue".

## Estado

| | |
|---|---|
| Rama | `main`. **Sin commits ni ramas nuevas sin permiso de la persona**: el trabajo queda en el árbol de trabajo |
| Punto de partida | `1e6fbc3` (los 14 arreglos del viernes ya están en `main`) |
| Pruebas backend al empezar | 200 de 200 pasan |
| Base de datos | Sin datos de prueba en Atlas. Chatbot sincronizado el 2026-11-14; la fase 7 (temas, respuestas y sugerencias nuevas) se aplicó el 2026-11-15 con `--respuestas --confirmar` |
| Dependencias nuevas | `pdfkit` y `nodemailer` en `backend/package.json` (hay que correr `npm install` en `backend/`) |

## Fases

| # | Fase | Estado |
|---|---|---|
| 0 | Este handover | Hecho |
| 1 | Tipografía del panel web, app de comandas más industrial, hover visible y gráficas. También: el pan animado de la web quedó más a la derecha | Hecho y visto en pantalla |
| 2 | Rango "Todo" en auditoría, pedidos y reportes, con paginación en auditoría | Hecho y visto en pantalla |
| 3 | Ilustración de mesas por capacidad y plano del salón (admin lo arma, mesero lo ve) | Hecho y visto en pantalla |
| 4 | Dividir la cuenta (partes iguales y por platos) | Hecho y visto en pantalla |
| 5 | Subir imágenes de platos desde el computador (se guardan en la base) | Hecho y visto en pantalla |
| 6 | Facturas en PDF por correo (Resend) y panel de facturas | Hecho y visto en pantalla. Falta un envío real con la clave de Resend |
| 7 | Chat más natural, con reglas | Hecho y visto en pantalla. Ya está en la base |

El detalle de cada fase (archivos, endpoints y pruebas) está más abajo, en "Qué hace cada fase".

## Decisiones ya tomadas por la persona (no volver a preguntar)

- **Chat:** camino gratuito. Se mejoran las reglas (varias respuestas por tema, charla corta, sugerencias); sin IA de pago.
- **Correo de facturas:** el 2026-11-15 la persona eligió **Gmail por SMTP** (`GMAIL_USUARIO`, `GMAIL_CLAVE_APP` en `backend/.env`) porque todavía no tiene dominio; Resend no entrega a otros destinatarios sin un dominio verificado. Resend sigue en el código (`RESEND_API_KEY`, `CORREO_REMITENTE`) para cuando haya dominio: basta quitar las variables de Gmail. Sin clave, la factura se emite y queda "sin enviar".
- **Estilo de la app de comandas:** se conserva la marca (espresso y crema); cambian las formas a rectas y técnicas. No le gusta la serifa Fraunces ni en el panel web ni en comandas.
- **Dividir cuenta:** las dos formas, en partes iguales y por platos; cada parte con su método de pago.
- **Iconos de mesas:** dibujados en código (SVG según capacidad y forma), no descargados.
- **Factura:** es un comprobante en PDF del pedido web, no factura electrónica ante la DIAN.
- **Commits:** ninguno sin permiso, y sin línea de coautoría.

## Qué hace cada fase

| Fase | Dónde | Qué |
|---|---|---|
| 1 | `frontend/src/pages/admin/admin.css`, `AdminChatbot.jsx` | Panel web en Figtree; tarjetas del chatbot con la descripción como título |
| 1 | `personal/index.html`, `personal/src/index.css`, `components/ui.jsx`, páginas | Una sola familia (Archivo con eje de ancho), esquinas rectas, utilidad `pulsable` para el hover |
| 1 | `personal/src/components/Barras.jsx` | Eje con 5 marcas, línea de promedio, entrada animada, porcentaje del total |
| 2 | `personal/src/components/ui.jsx` (`RangoFechas`), `frontend/src/pages/admin/comun.jsx` | Atajo "Todo". El backend ya acepta rango abierto (`rangoLocal`) |
| 2 | `backend/src/controllers/auditoriaController.js`, `services/auditoria.js` | Paginación por cursor (`antes`) y "Cargar más" |
| 3 | `backend/src/models/Mesa.js`, `mesaController.js`, `utils/serializar.js` | `forma`, `pos_x`, `pos_y`, `rotacion`; `PUT /api/admin/mesas/plano` |
| 3 | `personal/src/components/MesaIlustracion.jsx`, `pages/admin/MesasAdmin.jsx`, `pages/Mesas.jsx` | Ilustración SVG; plano arrastrable para el admin y de solo lectura para el mesero |
| 4 | `backend/src/models/Comanda.js`, `comandaController.cerrar`, `utils/pagos.js`, `services/caja.js`, `reporteController.js` | `POST /comandas/:id/cerrar` acepta `metodoPago` o `pagos: [{ metodo, monto, etiqueta }]`; la suma debe dar el total. `metodo_pago` queda como resumen (`MIXTO` si hay varios métodos) |
| 4 | `personal/src/components/comanda/Cobro.jsx`, `Division.jsx`, `lib/division.js` | Reparto en partes iguales o por platos; cada parte con su método |
| 5 | `backend/src/models/Imagen.js`, `services/imagenes.js`, `controllers/imagenController.js`, `routes/admin/imagenes.js` | `POST /api/admin/imagenes` (cuerpo binario, tope 1 MB, tipo leído de los bytes) y `GET /api/imagenes/:id` (público). Al cambiar la foto de un plato se borra la anterior si nadie la usa |
| 5 | `frontend/src/pages/admin/AdminMenu.jsx`, `utils/imagenes.js`, `services/menuService.js`; `personal/src/pages/admin/Platos.jsx`, `lib/imagenes.js` | "Subir desde el computador" con vista previa; se reduce a WebP (1200 px) en el navegador. La web resuelve `/api/imagenes/…` contra el origen del backend en `listarProductos` |
| 6 | `backend/src/models/Factura.js`, `services/facturas.js`, `controllers/facturaController.js`, `routes/facturaRoutes.js` | Consecutivo `BC-000001`, PDF con `pdfkit` (se arma al pedirlo, no se guarda), envío por la API de Resend. `GET /api/facturas`, `GET /api/facturas/pendientes`, `POST /api/facturas`, `POST /api/facturas/:id/enviar`, `GET /api/facturas/:id/pdf` (solo admin) |
| 6 | `services/pedidos.js#aplicarEstado` | Emite y envía al pasar a `entregado` con pago aprobado por transferencia |
| 6 | `frontend/src/pages/admin/AdminFacturas.jsx`, `api/api.js` (`descargar`) | Lista, ver PDF, generar (pedidos entregados sin comprobante) y reenviar |
| 7 | `backend/src/data/intenciones.js`, `services/chatbot.js`, `models/ChatIntent.js` (`sugerencias`), `controllers/chatController.js` | Varias respuestas por tema sin repetir la última; la charla cede ante una pregunta y devuelve el saludo; temas nuevos `como_estas`, `ayuda` y `recomendacion` (`{recomendacion}`); la respuesta trae `sugerencias` (las del tema o lo que el texto pide entre « ») |
| 7 | `frontend/src/components/ChatBox.jsx`, `services/chatService.js` | Botones de sugerencia después de cada respuesta; manda `anterior` para no repetir sin sesión |
| 7 | `backend/scripts/sincronizarIntenciones.js` | `-- --respuestas` agrega respuestas que falten y pone sugerencias donde no haya |

## Tercera ronda (2026-11-15, pedida por la persona al ver el resultado)

| Dónde | Qué |
|---|---|
| `personal/src/index.css` | Mano en todo lo pulsable (Tailwind 4 deja los botones con la flecha) y hover más simple: un velo del color del texto, sin aro, sombra ni salto. `pulsable` solo se hunde 1 px al pulsar |
| `personal/src/components/Barras.jsx`, `pages/admin/Reportes.jsx`, `lib/series.js` | Ventas por día es `SerieTiempo`: puntos unidos por una línea (la persona pidió dispersión con línea; no volver a barras). Se analiza con tres controles: por día o acumulado, línea que une los puntos o tendencia (media móvil de 7 días), y comparar con el periodo anterior, las mismas fechas del mes pasado o cualquier mes del último año (línea punteada azul, tarjetas con la variación). La comparación pide el otro periodo al mismo endpoint de ventas. Los rankings siguen en barras horizontales. |
| `personal/src/components/PlanoSalon.jsx`, `pages/admin/MesasAdmin.jsx` | Arrastre libre: la mesa sigue al puntero, una silueta marca la celda (verde si cabe, roja si no) y al soltar se acomoda sola. Las mesas de «Sin ubicar» se arrastran al plano (un toque las sigue poniendo en el primer hueco) |
| `backend/src/services/chatbot.js` (`consultarCarta`), `data/carta.js` | El chat busca en la carta antes de decir "no entendí": "¿venden cerveza?" responde que no y ofrece las bebidas que sí hay |
| `frontend/src/context/ChatContext.jsx`, `components/ChatFlotante.jsx`, `ChatBox.jsx` | Chat flotante en todas las páginas de clientes, con la misma conversación de la página de contacto |

## Cuarta ronda (2026-11-15): pantalla de carga

`frontend/src/components/PantallaCarga.jsx` y `context/CargaContext.jsx`: telón en dos capas, el pancito caminando (hoja de 8 cuadros con `steps`) y salida con saltito. Enganchada en `Login.jsx`, `Navbar.jsx` (salir y botón del panel), `usePerfilUsuario.js`, `Checkout.jsx` y `AdminLayout.jsx`. La hoja en WebP se generó con `sharp` desde el PNG que agregó la persona; los dos PNG originales quedaron en `assets/` sin usarse. Revisada en pantalla con la API simulada. **Sin commit todavía.**

## Quinta ronda (2026-11-16): lista de pruebas del equipo

Nueve puntos que el equipo encontró probando, más la pantalla de carga en comandas y al reservar. En `main`, sin `git push`.

| Punto | Dónde | Qué quedó |
|---|---|---|
| Un solo administrador | `backend/src/services/cuentas.js`; `personal/.../Personal.jsx`, `frontend/.../AdminUsuarios.jsx` | Dar el rol de admin a otra cuenta responde 409 y las listas de rol ya no lo ofrecen. No hay forma de pasar el rol a otra persona desde la app: se haría en la base |
| Domiciliario desde comandas | `services/pedidos.js#asignarDomiciliario`, `pedidoAdminController.js`, `routes/admin/gestion.js`; `personal/.../Pedidos.jsx` | Cada pedido web muestra quién lo lleva, con "Asignar" o "Cambiar domiciliario" (hoja con disponibles y ocupados, y "Nuevo domiciliario"). Endpoints nuevos: `PATCH /api/admin/pedidos/:id/domiciliario`, `GET` y `POST /api/admin/domiciliarios` |
| Cambio de domiciliario | `frontend/.../AdminPedidos.jsx` y la hoja de comandas | Con uno asignado la lista ya no queda abierta: "Cambiar domiciliario" es un paso aparte y en camino pide confirmar |
| Contador en la carta | `personal/.../comanda/Carta.jsx`, `pages/Comanda.jsx` | Menos, cantidad y más por plato. Repetir un plato sube la cantidad del renglón por enviar (antes creaba un renglón por toque) |
| Plato agotado | Los mismos | No se puede agregar ni sumar (mesero y admin usan la misma pantalla). El servidor sigue aceptándolo: el bloqueo es de la pantalla |
| Motivo en insumos | `personal/.../Insumos.jsx` | Texto bajo el título de Entrada y Merma que explica para qué es, con ejemplo en el campo |
| Caja y cuenta dividida | `personal/.../Caja.jsx` | Ya entraba sola (cada parte en su método). Ahora la caja lo dice en "¿Qué se suma solo y qué se registra a mano?" |
| Tarjeta y transferencia en Entrada | `personal/.../Caja.jsx` | Se conservan (anticipos, devoluciones) y la hoja aclara que las ventas ya se suman solas |
| Pedidos web en la caja | `services/caja.js`, `models/Payment.js` (`aprobado_en`), `pagoController.js` | Entran solos al aprobar el pago y salen si el pedido se cancela. El cuadre los trae aparte (`ventasWeb`, `pedidosWeb`) |
| Pantalla de carga en comandas | `personal/src/components/PantallaCarga.jsx`, `context/CargaContext.jsx`, `context/carga.js`, `index.css`, `assets/` | El pancito, solo con CSS. Sale al entrar con correo, por `/entrar` y al abrir con sesión guardada |
| Pantalla de carga al reservar | `frontend/src/pages/Reservas.jsx` | "Guardando tu mesa…" antes de la confirmación |

Decisiones que tomó el asistente sin preguntar (la persona puede cambiarlas): los pedidos web cuentan en caja al **aprobar el pago** y no al entregar; un pedido cancelado deja de contar (la devolución no se registra aparte); las opciones de tarjeta y transferencia en los movimientos manuales se dejaron, con explicación.

## Qué sigue

Todo lo que queda necesita a la persona:

0. **Quinta ronda:** commit hecho el 2026-11-16 con permiso; subirlo lo decide la persona. Falta una prueba real con el backend encendido: aprobar el pago de un pedido `[E2E]` con la caja abierta y asignarle domiciliario desde comandas.
1. **Chat en la base:** hecho el 2026-11-15 (23 cambios aplicados con permiso de la persona).
2. **Correo de facturas:** hecho el 2026-11-15. `GMAIL_USUARIO` y `GMAIL_CLAVE_APP` están en `backend/.env` (cuenta institucional de Google, no `@gmail.com`); Gmail aceptó la clave y un comprobante de prueba enviado a la misma cuenta. Falta probarlo desde el panel con un pedido `[E2E]` y que la persona cambie la contraseña de aplicación (quedó escrita en una conversación).
3. **Palabras clave del menú:** hecho el 2026-11-15 ("que venden", "que ofrecen" y "que sirven" ya están en la base).
4. **Commit:** hecho en `main` el 2026-11-15, con permiso y sin línea de coautoría. No se hizo `git push`: subirlo lo decide la persona. Cuando ya no quede nada pendiente de esta lista, borrar este archivo.

`AGENTS.md` y `backend/README.md` ya están al día con las 7 fases.

## Trampas ya conocidas

- **Shell:** un heredoc de Bash largo con comillas simples falla ("unexpected EOF"). Para ediciones grandes, usar la herramienta de edición o un script en un archivo temporal.
- **Pruebas:** `npm test` tarda cerca de 5 minutos (un `mongod` por archivo). Para iterar: `node --test --test-concurrency=1 --test-timeout=300000 tests/<archivo>.test.js`. No editar `backend/src` mientras corre una suite.
- **Pruebas con comparación exacta** (`toEqual`) se rompen al agregar campos a una respuesta: revisar `admin.test.js` y `ws.test.js`.
- **Pruebas del chatbot:** una frase de reserva deja la conversación dentro del flujo de reserva. Para medir la detección, llamar `detectarIntencion` directo. Editar, cancelar y crear reservas no los decide `detectarIntencion` sino su flujo en `chatController`: para esos, probar como visitante por la API. Los temas con varias respuestas no se comparan con un texto exacto.
- **ESLint de `personal`** no ve el uso de un componente desestructurado en un `map` (`({ Icono }) => <Icono/>`). Usar `opcion.Icono`.
- **Mongoose:** `populate` de un campo que no está en el esquema lanza error (`strictPopulate`).
- **Revisar pantallas con el backend encendido:** el WebSocket real rechaza el token simulado (4401) y la app del personal cierra la sesión. Simularlo también: `page.routeWebSocket(/\/ws/, () => {})`.
- **Capturas con animaciones:** la ventana que maneja Playwright a veces no pinta cuadros y las transiciones se quedan a medio camino en la captura (una mesa o un panel "fuera de lugar"). Antes de capturar: `document.getAnimations().forEach((a) => a.finish())`. Los valores de `style` sí son los finales.
- **Revisar pantallas sin backend:** Playwright con `page.route("**/api/**")`. El token simulado necesita forma de JWT con `exp` futuro en `localStorage` (`brunch_staff_token`, `brunch_staff_user`). En la web basta `brunch_token` con cualquier texto y simular `/auth/perfil` con `rol_id: "admin"`; su API está en `http://localhost:3000/api/**`. El MCP de Playwright solo lee archivos dentro del repo: los scripts y capturas van en `.playwright-mcp/` (ignorada por git; quedaron `revisar_personal.js` y `revisar_web.js`).
- **Capturas de página completa** recortan el borde derecho (la barra de scroll): no es un desborde real. Comprobar con `document.documentElement.scrollWidth`.
- **Prueba real de pedidos web:** el plato e2e tiene que crearse con `visibleWeb: true`. Usar plato, insumo y receta `[E2E]` propios: con un plato real, el consumo toca inventario real y `e2e:limpiar` no borra esos movimientos. El admin e2e se crea directo con el modelo `User`.
- **Gmail:** la clave es una contraseña de aplicación de 16 letras (se pega con o sin espacios). Con la contraseña normal de la cuenta, Gmail responde `EAUTH` y el panel muestra "Gmail rechazó el usuario o la contraseña de aplicación".
- **Resend:** solo envía a cualquier destinatario con un dominio verificado. Sin dominio, solo llega al correo de la cuenta de Resend. En las pruebas se reemplaza `global.fetch`; nunca sale un correo real.
- **Cuenta dividida:** la app propone los montos, pero el total lo calcula el servidor. Con cierre forzado (platos en cocina que se cancelan) el total baja: `Cobro.jsx` ya reparte ese total y no `comanda.total`.
- **Imágenes:** una foto subida que nunca se guarda en un plato queda huérfana en la colección `imagenes` (solo se limpia al cambiar la foto de un plato). `express.json()` global no lee `image/*`: por eso la ruta de subida usa `express.raw`.
- **Facturas:** si dos peticiones emiten a la vez el comprobante del mismo pedido, gana una y el consecutivo de la otra queda sin usar (un hueco en la numeración).
- **Plano del salón:** la regla de cuántas celdas ocupa una mesa está dos veces, en `backend/src/utils/plano.js` y en `personal/src/lib/plano.js`. Si cambia una, cambia la otra.
- **Reportes de todo el tiempo:** se piden con `?todo=true`; sin fechas el informe sigue siendo el de hoy. Con más de 45 días la gráfica se agrupa por mes.
- **Radios y hover de la app de comandas:** los radios salen de `--radius-*` en `personal/src/index.css` (no de cada pantalla). Todo `button` y enlace recibe un aro al pasar el mouse; `data-sin-hover` lo apaga y la clase `pulsable` agrega el levantado.
- **Build de la web:** `npm run build` en `frontend/` reescribe las imágenes de `frontend/public` (optimizador de Vite) y quedan como modificadas en git. Después de verificar, `git restore -- frontend/public`.
- **Un solo admin en las pruebas:** por la API ya no se puede crear otro admin. En las pruebas se crea con `crearPersonal("admin", …)` o `User.create` (así quedó `e2e.test.js`).
- **Playwright sin el MCP:** si el MCP no conecta, `node .playwright-mcp/revisar_ronda5.js` usa el `playwright-core` que quedó en la caché de `npx` y los navegadores ya descargados. Simula la API de las dos apps (la web necesita cabeceras CORS en las respuestas simuladas).
- **Sesión simulada en la web con Vite recién arrancado:** la primera visita puede recargar la página (optimiza dependencias); la petición de perfil cortada borra `brunch_token` y la página cae al login. El script reintenta.
- **`git restore`:** el modo automático del asistente lo bloquea. Si el build de la web deja `frontend/public` modificado, lo restaura la persona.
- **GitHub CLI:** `gh` no está instalado en este equipo.
- **Servidores de desarrollo:** se detienen al terminar la sesión. Volver a levantarlos (`npm run dev` en cada carpeta).

## Cómo mantener este archivo

- Actualízalo **antes de que se acabe la sesión** (límite de tokens o de tiempo) y al terminar cada fase. No esperes al final.
- Cambia solo lo que cambió: la fecha, la tabla de fases, "Qué sigue" y, si aplica, una trampa nueva.
- Lo terminado se resume en una línea; el detalle vive en el código y en git.
- Cuando todo esté fusionado en `main`, borra este archivo.
