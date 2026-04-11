# ── Stage 1: Build librist from source ───────────────────────────────────────
FROM alpine:3.19 AS builder

RUN apk add --no-cache \
    build-base \
    meson \
    ninja \
    git \
    cmake \
    mbedtls-dev \
    linux-headers

RUN git clone --depth 1 --branch v0.2.11 \
    https://code.videolan.org/rist/librist.git /src

WORKDIR /src
RUN meson setup build --buildtype=release \
    && ninja -C build \
    && ninja -C build install

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine

RUN apk add --no-cache libstdc++

# Copy ristreceiver, librist, and the exact mbedtls version used at build time
COPY --from=builder /usr/local/bin/ristreceiver /usr/local/bin/ristreceiver
COPY --from=builder /usr/local/lib/librist* /usr/local/lib/
COPY --from=builder /usr/lib/libmbed* /usr/local/lib/

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/data /app/logs

ENV RIST_API_PORT=3001 \
    RISTRECEIVER_BIN=/usr/local/bin/ristreceiver \
    RIST_STATE_FILE=/app/data/receivers.json \
    NODE_ENV=production \
    LD_LIBRARY_PATH=/usr/local/lib

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "server.js"]
