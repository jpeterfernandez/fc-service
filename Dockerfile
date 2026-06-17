# ── Stage 1: Build frontend ──────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN npm ci --prefix frontend
COPY frontend/ ./frontend/
RUN npm run build --prefix frontend

# ── Stage 2: Production runner ───────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Instalar dependencias del backend sin devDependencies
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend --omit=dev

# Copiar código del backend
COPY backend/ ./backend/

# Copiar el frontend compilado en el stage 1
COPY --from=builder /app/frontend/dist ./frontend/dist

# Asegurar directorios temporales para las sesiones de WhatsApp y subidas
RUN mkdir -p /tmp/whatsapp-sessions /tmp/uploads

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001
CMD ["node", "backend/server.js"]
