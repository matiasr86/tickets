# ---- Base de dependencias (instala node_modules con lockfile) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Instala solo dependencias de producción
RUN npm ci --omit=dev

# ---- Imagen final (runtime) ----
FROM node:20-alpine AS runner
WORKDIR /app

# Variables por defecto (podés sobreescribir con -e o --env-file)
ENV NODE_ENV=production \
    PORT=3000

# Copiamos node_modules desde la etapa deps
COPY --from=deps /app/node_modules ./node_modules

# Copiamos el código
COPY src ./src
COPY public ./public
COPY package*.json ./

# Seguridad: ejecutamos como usuario "node"
USER node

# Exponemos el puerto de la app (lo va a mapear Nginx o docker run)
EXPOSE 3000

# Healthcheck simple contra /health (wget viene en Alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

# Comando de arranque
CMD ["node", "src/server.js"]

