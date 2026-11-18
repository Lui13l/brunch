# API y WebSocket de Brunch & Co. Corre en una sola instancia: las suscripciones
# del WebSocket viven en memoria.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    MONGOMS_DISABLE_POSTINSTALL=1

# Primero las dependencias, para que Docker las reutilice si solo cambia el código.
# Sin las de desarrollo: mongodb-memory-server descargaría ~1,3 GB.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY scripts ./scripts

USER node
EXPOSE 3000

# La raíz responde un JSON fijo sin tocar la base: sirve para saber si arrancó.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
