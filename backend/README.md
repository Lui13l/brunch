# Backend Brunch

API REST con Express 5 + Mongoose 9 sobre MongoDB Atlas.

## Puesta en marcha

```bash
cd backend
npm install
cp .env.example .env   # completa MONGO_URI y JWT_SECRET
npm run seed           # roles, usuario admin, categorías y productos de ejemplo
npm run dev            # http://localhost:3000
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga automática (`node --watch`) |
| `npm start` | Servidor normal |
| `npm run seed` | Carga roles, admin, el menú de Brunch & Co. e intenciones del chatbot. Se puede repetir sin duplicar nada |
| `npm test` | Tests de la API sobre una MongoDB en memoria (no toca Atlas) |

La primera vez que se ejecuta `npm test` se descarga el binario de MongoDB (~700 MB). Si ya tienes MongoDB instalado puedes evitarlo así:
`MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe" npm test`

## Variables de entorno

Ver [.env.example](.env.example). Las obligatorias son `MONGO_URI` y `JWT_SECRET`. Para activar el login con Google, define `GOOGLE_CLIENT_ID` con el ID de cliente OAuth 2.0 de tipo aplicación web.

## Seguridad

- **Cabeceras:** `helmet` añade las cabeceras de seguridad HTTP habituales y oculta `X-Powered-By`.
- **CORS:** solo acepta peticiones de los orígenes de `CORS_ORIGIN`. Si no se define, acepta todos (útil en desarrollo).
- **Login y registro:** como máximo `RATE_LIMIT_AUTH_MAX` intentos **fallidos** por IP cada 15 minutos (10 por defecto). Pasado el límite se responde 429.
- **Chatbot:** como máximo `RATE_LIMIT_CHAT_MAX` mensajes por usuario y minuto (20 por defecto).
- **Detrás de un proxy:** en producción con proxy, define `TRUST_PROXY=1`. Si no, todos los clientes parecerán tener la misma IP y compartirán el límite.
- **Contraseñas:** se guardan cifradas con bcrypt y nunca se devuelven en las respuestas.

## Estructura

```
src/
  server.js        arranque: conecta a la BD y levanta el servidor
  app.js           configuración de Express (CORS, JSON, rutas, errores)
  seed.js          datos iniciales
  config/          conexión a MongoDB
  models/          esquemas de Mongoose (index.js los exporta todos)
  routes/          definición de endpoints
  controllers/     lógica de cada endpoint
  services/        lógica del chatbot (detección de intenciones y respuestas)
  data/            menú inicial (menu.js) e intenciones del chatbot (intenciones.js)
  middleware/      autenticación, roles y manejo de errores
  utils/           HttpError y pick()
tests/             tests de integración (node:test + supertest)
```

## Autenticación

`POST /api/auth/login` devuelve un `token`. En las rutas protegidas se envía en la cabecera:

```
Authorization: Bearer <token>
```

Hay dos roles: `cliente` (por defecto al registrarse) y `admin`.

## Endpoints

Todas las rutas empiezan por `/api`. Las respuestas incluyen `id` además de `_id`.

### Auth y usuarios
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/auth/registro` | Público | `{nombre, correo, password, direccion?, celular?}` |
| POST | `/auth/login` | Público | `{correo, password}` → `{token, usuario}` |
| POST | `/auth/google` | Público | `{credential}` (ID token verificado por Google) → `{token, usuario}` |
| GET | `/auth/perfil` | Usuario | Datos del usuario del token |
| POST | `/auth/logout` | Usuario | Revoca el token de la sesión actual |
| PUT | `/usuarios/perfil` | Usuario | Actualiza `nombre, direccion, celular, password` |
| GET | `/usuarios` | Admin | Lista usuarios (`?rol_id=`) |
| GET | `/usuarios/:id` | Admin | Detalle |
| PATCH | `/usuarios/:id/rol` | Admin | `{rol_id}` |

### Menú
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/productos` | Público | Productos activos ordenados por `orden` (`?categoria=`, `?tipo=`). Admin: `?incluir_inactivos=true` |
| GET | `/productos/:id` | Público | Detalle |
| POST | `/productos` | Admin | `{tipo, nombre, precio, categoria_id, descripcion?, img_url?, orden?}`. `img_url` puede ser una ruta del frontend, como `/menu/pancakes.jpg` |
| PUT | `/productos/:id` | Admin | Actualiza campos |
| DELETE | `/productos/:id` | Admin | Lo desactiva (`activo: false`) |
| GET | `/categorias` | Público | Lista |
| POST / PUT / DELETE | `/categorias[/:id]` | Admin | `{nombre, orden?}`. Se listan por `orden`. No se borra si tiene productos |

### Pedidos
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/pedidos` | Usuario | `{items: [{menu_item_id, cantidad}], direccion_pedido?, observaciones?, fecha_programada?}`. Precios y total se calculan en el servidor |
| GET | `/pedidos/mis-pedidos` | Usuario | Pedidos propios |
| GET | `/pedidos` | Admin | Todos (`?estado=`, `?usuario_id=`, `?domiciliario_id=`) |
| GET | `/pedidos/:id` | Dueño / admin | Detalle con pago y domiciliario |
| PATCH | `/pedidos/:id/cancelar` | Dueño / admin | Solo si está `pendiente` o `confirmado` |
| PATCH | `/pedidos/:id/estado` | Admin | `{estado}` |
| PATCH | `/pedidos/:id/domiciliario` | Admin | `{domiciliario_id}`. El domiciliario pasa a `ocupado` |

Flujo de estados: `pendiente → confirmado → preparando → en_camino → entregado`. Se puede cancelar desde cualquier estado anterior a `en_camino`. Al entregar o cancelar, el domiciliario vuelve a quedar `disponible`.

### Pagos
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/pagos` | Dueño del pedido | `{pedido_id, metodo, referencia?}`. `metodo`: efectivo, tarjeta o transferencia. El monto es el total del pedido |
| GET | `/pagos` | Admin | Lista (`?estado=`, `?metodo=`, `?pedido_id=`) |
| GET | `/pagos/:id` | Dueño / admin | Detalle |
| PATCH | `/pagos/:id/estado` | Admin | `{estado: "aprobado" \| "rechazado"}`. Aprobar confirma el pedido pendiente |

### Reservas
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/reservas` | Usuario | `{dia: "YYYY-MM-DD", hora: "HH:MM", cupo, ocasion?, detalles?}` |
| GET | `/reservas/mis-reservas` | Usuario | Reservas propias |
| GET | `/reservas` | Admin | Todas (`?fecha=YYYY-MM-DD`, `?estado=`) |
| GET | `/reservas/:id` | Dueño / admin | Detalle |
| PATCH | `/reservas/:id/cancelar` | Dueño / admin | Cancela |
| PATCH | `/reservas/:id/estado` | Admin | `{estado}`: `pendiente → confirmada → finalizada` |

### Domiciliarios (solo admin)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/domiciliarios` | Lista (`?estado=`) |
| GET | `/domiciliarios/:id` | Detalle |
| POST | `/domiciliarios` | `{nombre, apellido}` |
| PUT | `/domiciliarios/:id` | Actualiza |
| PATCH | `/domiciliarios/:id/estado` | `{estado: "disponible" \| "ocupado" \| "inactivo"}` |
| DELETE | `/domiciliarios/:id` | Lo marca `inactivo` |

### Chatbot
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/chat/mensaje` | Público | `{mensaje, conversacion_id?}` → `{conversacion_id, intencion, respuesta}`. Sin sesión responde pero no guarda la conversación (`conversacion_id: null`) |
| GET | `/chat/conversaciones` | Usuario | Conversaciones propias, sin mensajes (`?estado=`). Admin: `?todas=true` |
| GET | `/chat/conversaciones/:id` | Dueño / admin | Conversación con todos sus mensajes |
| PATCH | `/chat/conversaciones/:id/finalizar` | Dueño / admin | Cierra la conversación |
| GET | `/chat/intenciones` | Admin | Lista las intenciones |
| POST | `/chat/intenciones` | Admin | `{nombre, palabras_clave: [], respuestas: [{respuesta}], descripcion?, activa?}` |
| PUT | `/chat/intenciones/:id` | Admin | Actualiza campos (por ejemplo `{activa: false}`) |
| DELETE | `/chat/intenciones/:id` | Admin | Elimina |

**Cómo funciona:**
- **Conversación:** si no se envía `conversacion_id`, el mensaje sigue la última conversación activa del usuario, o abre una nueva.
- **Visitantes:** sin sesión el bot responde igual (menú, horario, pagos…). `{nombre}` se omite y `{ultimo_pedido}` / `{mis_reservas}` piden iniciar sesión.
- **Detección:** el texto se compara con las `palabras_clave` de cada intención activa, sin tener en cuenta mayúsculas ni tildes. Gana la que más palabras coinciden, así que "hacer un pedido" gana a "pedido". Si ninguna coincide se usa la intención `desconocida`.
- **Respuesta:** si la intención tiene varias respuestas, se elige una al azar.
- **Variables:** una respuesta puede incluir variables que se rellenan con datos reales:

| Variable | Se reemplaza por |
|---|---|
| `{nombre}` | Nombre del usuario |
| `{menu}` | Productos activos agrupados por categoría, con precio |
| `{ultimo_pedido}` | Productos, total y estado del último pedido |
| `{mis_reservas}` | Reservas próximas pendientes o confirmadas |

Las intenciones iniciales están en [src/data/intenciones.js](src/data/intenciones.js). Volver a ejecutar el seed solo crea las que falten y no sobrescribe las que el admin haya editado.

## Salón y administración (app `personal`)

La app del personal ([../personal](../personal)) usa estas rutas. Responden en camelCase, con ids como texto, dinero y stock como números y fechas en hora de Bogotá sin `Z` (`ZONA_HORARIA`). **Sus errores son texto plano**, no JSON.

**Roles:** `admin`, `mesero`, `cocina` y `cliente`. Hacia la app salen en mayúscula (`ADMIN`, `MESERO`, `COCINA`, y `USUARIO` para cliente). Una cuenta con `activo: false` no puede entrar y sus tokens dejan de servir.

| Ruta | Quién | Qué hace |
|---|---|---|
| `POST /api/usuarios/login` | público | Login del personal: `{email, password}` → usuario plano + `token` |
| `GET /api/mesas`, `GET /api/salon/menu` | mesero, cocina, admin | Mesas activas (con `comandaAbiertaId`) y carta del salón |
| `/api/comandas` | mesero, admin | Abrir cuenta, agregar, editar y quitar platos en borrador, `enviar` a cocina (descuenta inventario por receta), `cancelar`, `entregar`, `cerrar` (cobro) |
| `/api/cocina` | cocina, admin | `GET /pendientes` y `PATCH /items/:id {estado: PREPARANDO\|LISTO}` |
| `/api/admin/mesas`, `/api/admin/menu` | admin | Mesas y carta (`disponible`, `visibleWeb`, `visibleSalon`) |
| `/api/admin/insumos`, `/api/admin/recetas` | admin | Inventario (ajustes y movimientos) y recetas por plato |
| `/api/admin/caja` | admin | Abrir y cerrar caja, entradas y salidas, cuadre, historial |
| `/api/admin/reportes/ventas\|consumo` | admin | `?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` (por defecto, hoy) |
| `/api/admin/personal` | admin | Crear meseros y cocina, cambiar rol, activar o desactivar, poner contraseña |
| `/api/admin/pedidos` | admin | Pedidos web (`?activos=true`, `?estado=`, fechas) y `PATCH /:id/estado` |
| `/api/admin/auditoria` | admin | Quién hizo qué: `?servicio=&usuarioId=&desde=&hasta=&limite=` |

Reglas importantes:
- Una mesa solo puede tener una cuenta abierta, y solo puede haber una caja abierta (índices únicos parciales).
- Enviar a cocina nunca se bloquea por falta de stock. El stock queda en negativo y se avisa con `faltantes`.
- Enviar, cancelar y cobrar usan **transacciones**, que necesitan un replica set. Atlas ya lo es; un MongoDB local suelto no.

### Tiempo real (WebSocket en `/ws`)

1. El cliente envía `{type:"auth", token}` y el servidor responde `ready`.
2. El cliente se suscribe con `{type:"subscribe", topics:[...]}`.
3. Los avisos llegan como `{type:"message", topic, data}`.

Temas:

| Tema | Quién puede suscribirse |
|---|---|
| `/topic/salon` | mesero, cocina, admin |
| `/topic/cocina` | cocina, admin |
| `/topic/mesero/{id}/comandas` | ese mesero o un admin |
| `/topic/admin/caja`, `/topic/admin/pedidos`, `/topic/admin/pedidos/estado`, `/topic/admin/inventario` | admin |

Códigos de cierre:
- **4401**: la sesión no vale (token inválido, logout o cuenta desactivada).
- **4403**: cambió el rol del usuario.

El origen del navegador debe estar en `WS_ORIGINS` (o en `CORS_ORIGIN`). Las suscripciones viven en memoria, así que hay que usar **una sola instancia** del backend.

### Pruebas e2e en la base compartida

Las pruebas end-to-end marcan todo lo que crean:
- correos `@e2e.brunch.test`
- mesas con número 900 o más, o con nombre que empieza por `E2E`
- insumos y platos con nombre que empieza por `[E2E]`

Para limpiar:
- `npm run e2e:limpiar` cuenta lo que borraría.
- `npm run e2e:limpiar -- --confirmar` lo borra.

## Errores

Las respuestas de error de la web tienen la forma `{ "mensaje": "..." }`, y los errores de validación añaden un array `errores`. Las rutas del personal responden el mismo mensaje en texto plano.

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos, id mal formado o transición de estado no permitida |
| 401 | Falta el token o no es válido |
| 403 | El rol no tiene permiso o el recurso es de otro usuario |
| 404 | Recurso o ruta inexistente |
| 409 | Duplicado (correo, categoría) o conflicto (domiciliario ocupado, pago repetido) |
| 429 | Demasiados intentos (login, registro o mensajes al chatbot) |
