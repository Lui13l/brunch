# Web de clientes: se compila con Vite y la sirve nginx, que además pasa /api al backend.
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite escribe estas variables dentro del JavaScript al compilar: cambiarlas
# exige volver a construir la imagen. Por defecto la API va por el mismo origen
# (nginx la pasa al backend), así que no hace falta CORS.
ARG VITE_API_URL=/api
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_PERSONAL_URL=http://localhost:5174
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_PERSONAL_URL=$VITE_PERSONAL_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
