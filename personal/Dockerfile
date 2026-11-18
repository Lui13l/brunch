# App del personal: se compila con Vite y la sirve nginx, que hace lo mismo que
# el proxy de Vite en desarrollo: pasa /api y /ws al backend.
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vacía, las rutas /api y /ws van al mismo origen y nginx las pasa al backend.
# Solo se llena si el backend está en otro dominio (se escribe al compilar).
ARG VITE_BACKEND_URL=
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
