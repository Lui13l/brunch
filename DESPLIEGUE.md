# Despliegue

El proyecto se publica en dos sitios:

| Parte | Dónde | Por qué |
|---|---|---|
| `frontend/` (web de clientes) | Vercel, proyecto 1 | Es un sitio estático de Vite |
| `personal/` (app del personal) | Vercel, proyecto 2 | Igual |
| `backend/` (API y WebSocket) | Render | Vercel corre funciones que se apagan entre peticiones. El WebSocket `/ws` necesita un servidor siempre encendido y una sola instancia, porque las suscripciones viven en memoria |

La base sigue siendo la misma de MongoDB Atlas, con datos reales. Desplegar no siembra ni borra nada.

Hay que seguir este orden: primero el backend, porque los frontends necesitan su dirección.

## 1. Atlas: dejar entrar a Render

En Atlas → Network Access, agrega `0.0.0.0/0`. El plan gratis de Render no tiene una IP fija. La base sigue protegida por usuario y contraseña.

## 2. Backend en Render

1. En [render.com](https://render.com), entra con GitHub. Ve a **New → Blueprint** y elige este repo. Render lee [render.yaml](render.yaml).
2. Te pide las variables marcadas `sync: false`. Cópialas de tu `backend/.env`, sin pegarlas en ningún otro lado:
   - `MONGO_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`.
   - `CORS_ORIGIN`: por ahora déjala vacía y complétala en el paso 5.
   - Correo: `GMAIL_USUARIO` y `GMAIL_CLAVE_APP`, o `RESEND_API_KEY` y `CORREO_REMITENTE`. Las que no uses, déjalas vacías.
   - `OPENWEATHER_API_KEY` es opcional.
3. Cuando termine, abre `https://brunch-api.onrender.com/` (o el nombre que te asigne Render). Debe responder `"Servidor de Brunch funcionando correctamente"`.

El plan gratis se duerme tras 15 minutos sin uso. La primera petición después tarda unos 50 segundos, y la app del personal reconecta sola. Para que no se duerma, usa el plan Starter.

## 3. Web de clientes en Vercel

1. En [vercel.com](https://vercel.com), ve a **Add New → Project** y elige este repo.
2. En **Root Directory** pon `frontend`. La configuración de build ya está en [frontend/vercel.json](frontend/vercel.json).
3. Agrega estas variables (Environment Variables):

   | Variable | Valor |
   |---|---|
   | `VITE_API_URL` | `https://brunch-api.onrender.com/api` |
   | `VITE_GOOGLE_CLIENT_ID` | el mismo del backend |
   | `VITE_PERSONAL_URL` | la dirección del proyecto 2 (paso 4); se puede poner después |

4. Pulsa **Deploy**.

## 4. App del personal en Vercel

1. Crea otro proyecto con el mismo repo y pon **Root Directory** en `personal`.
2. Agrega la variable `VITE_BACKEND_URL` = `https://brunch-api.onrender.com`, sin `/api`.
3. Pulsa **Deploy**.

Las variables `VITE_*` se leen al compilar. Si cambias una, vuelve a desplegar el proyecto: en Deployments, abre el menú ⋯ y elige **Redeploy**.

## 5. Unir las piezas

1. En Render, pon `CORS_ORIGIN` con las dos direcciones de Vercel, sin barra al final y separadas por coma:
   `https://brunch-web.vercel.app,https://brunch-personal.vercel.app`
   La misma lista sirve para el WebSocket.
2. En Vercel, revisa que `VITE_PERSONAL_URL` del proyecto 1 tenga la dirección del proyecto 2, y vuelve a desplegarlo.
3. En Google Cloud Console → Credenciales → tu cliente OAuth, agrega la dirección de la web en **Orígenes autorizados de JavaScript**.

## 6. Probar

- Abre la web y revisa que carguen la carta, las fotos y el chat.
- Entra a `/admin` y pulsa "Abrir comandas". Debe abrir la app del personal con la sesión iniciada.
- En la app del personal, abre Mesas y Cocina. En la consola del navegador no debe haber errores de CORS ni de `wss://`.

## Dominio propio (para Resend)

Una dirección `*.vercel.app` no sirve para Resend, porque sus DNS son de Vercel. Para enviar con Resend:

1. Compra un dominio. Puede ser en Vercel (Settings → Domains) o en otro registrador.
2. Conéctalo así: el dominio raíz a la web, `personal.` a la app del personal y `api.` a Render (Settings → Custom Domains, con un registro CNAME).
3. En Resend → Domains, agrega el dominio y copia sus registros (MX, TXT de SPF y DKIM) en el DNS del dominio. Espera a que salga "Verified".
4. En Render, pon `RESEND_API_KEY` y `CORREO_REMITENTE` (`Brunch & Co. <pedidos@tu-dominio.com>`), y borra las variables de Gmail: si están las dos opciones, manda Gmail.
5. Actualiza con los dominios nuevos `CORS_ORIGIN`, `VITE_API_URL`, `VITE_BACKEND_URL`, `VITE_PERSONAL_URL` y los orígenes de Google.
