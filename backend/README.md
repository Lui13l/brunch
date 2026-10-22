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
| `npm run seed` | Carga datos iniciales e intenciones del chatbot. Se puede repetir sin duplicar nada |
| `npm test` | Tests de la API sobre una MongoDB en memoria (no toca Atlas) |

La primera vez que se ejecuta `npm test` se descarga el binario de MongoDB (~700 MB). Si ya tienes MongoDB instalado puedes evitarlo así:
`MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe" npm test`

## Variables de entorno

Ver [.env.example](.env.example). Las obligatorias son `MONGO_URI` y `JWT_SECRET`.

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
  data/            intenciones iniciales del chatbot
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
| GET | `/auth/perfil` | Usuario | Datos del usuario del token |
| PUT | `/usuarios/perfil` | Usuario | Actualiza `nombre, direccion, celular, password` |
| GET | `/usuarios` | Admin | Lista usuarios (`?rol_id=`) |
| GET | `/usuarios/:id` | Admin | Detalle |
| PATCH | `/usuarios/:id/rol` | Admin | `{rol_id}` |

### Menú
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/productos` | Público | Productos activos (`?categoria=`, `?tipo=`). Admin: `?incluir_inactivos=true` |
| GET | `/productos/:id` | Público | Detalle |
| POST | `/productos` | Admin | `{tipo, nombre, precio, categoria_id, descripcion?, img_url?}` |
| PUT | `/productos/:id` | Admin | Actualiza campos |
| DELETE | `/productos/:id` | Admin | Lo desactiva (`activo: false`) |
| GET | `/categorias` | Público | Lista |
| POST / PUT / DELETE | `/categorias[/:id]` | Admin | `{nombre}`. No se borra si tiene productos |

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
| POST | `/chat/mensaje` | Usuario | `{mensaje, conversacion_id?}` → `{conversacion_id, intencion, respuesta}` |
| GET | `/chat/conversaciones` | Usuario | Conversaciones propias, sin mensajes (`?estado=`). Admin: `?todas=true` |
| GET | `/chat/conversaciones/:id` | Dueño / admin | Conversación con todos sus mensajes |
| PATCH | `/chat/conversaciones/:id/finalizar` | Dueño / admin | Cierra la conversación |
| GET | `/chat/intenciones` | Admin | Lista las intenciones |
| POST | `/chat/intenciones` | Admin | `{nombre, palabras_clave: [], respuestas: [{respuesta}], descripcion?, activa?}` |
| PUT | `/chat/intenciones/:id` | Admin | Actualiza campos (por ejemplo `{activa: false}`) |
| DELETE | `/chat/intenciones/:id` | Admin | Elimina |

**Cómo funciona:**
- **Conversación:** si no se envía `conversacion_id`, el mensaje sigue la última conversación activa del usuario, o abre una nueva.
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

## Errores

Todas las respuestas de error tienen la forma `{ "mensaje": "..." }`. Los errores de validación añaden un array `errores`.

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos, id mal formado o transición de estado no permitida |
| 401 | Falta el token o no es válido |
| 403 | El rol no tiene permiso o el recurso es de otro usuario |
| 404 | Recurso o ruta inexistente |
| 409 | Duplicado (correo, categoría) o conflicto (domiciliario ocupado, pago repetido) |
| 429 | Demasiados intentos (login, registro o mensajes al chatbot) |
