# ── Stage 1: Build React app ──────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY html/package*.json ./
RUN npm ci

COPY html/ ./

ARG REACT_APP_BASE_URL
ARG REACT_APP_SRT_PLAYER_PORT=4000
ARG REACT_APP_SRT_SENDER_PORT=4001
ARG REACT_APP_SLS_STATS_PORT=8080
ARG REACT_APP_SRTLA_PORT
ARG REACT_APP_RIST_API_URL=http://localhost:3001

RUN npm run build

# ── Stage 2: nginx serves the static build ────────────────────────────────────
FROM nginx:1.25-alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s \
    CMD wget -qO- http://localhost/ || exit 1
