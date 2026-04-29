# RISTMonitor

Combined management UI for **SRT Live Server** and **RIST** streams. Based on [OpenIRL/sls-management-ui](https://github.com/OpenIRL/sls-management-ui), extended with a full RIST receiver management stack.

## Features

- **SRT**: Manage publishers and stream IDs via SLS API
- **RIST**: Create/stop `ristreceiver` instances, monitor live flows with per-flow stats
- **Persistent Config**: API keys and settings auto-save to `/data/config.json` — survive Docker restarts
- **Encrypted Backups**: Export/import encrypted config files with password protection (AES-256-GCM)
- Service selection on first launch — use SRT, RIST, or both independently
- Per-flow stats: quality ratio, packet loss/recovery, peer connections with RTT
- Copy-to-clipboard for stream URLs (always visible, even when masked)
- QR code generation for quick mobile entry (toggleable)
- SRT relay (UDP→SRT) with auto-generated passphrase or custom encryption
- Developer mode: live ristreceiver and relay process logs

## Requirements

- [librist](https://code.videolan.org/rist/librist) — `brew install librist`
- Node.js 18+
- Docker & Docker Compose (optional, for production deployment)

## Quick Start (Local Dev)

```bash
# 1. Install dependencies
npm install --prefix html
npm install --prefix api

# 2. Start the RIST API server (port 3001)
node api/server.js

# 3. Start the UI (port 3000)
npm start --prefix html
```

Open `http://localhost:3000`, select your services, configure settings. Config is saved to localStorage and synced to the API.

## Docker Deployment

```bash
# Build and start containers
docker compose build
docker compose up -d

# Check health
docker compose exec rist-api npm run health

# View logs
docker compose logs -f rist-api
docker compose logs -f ui
```

UI accessible at `http://localhost` (or `http://localhost:8080` if remapped).

### Persistence

Settings and API keys are auto-saved to **`./data/config.json`** (created on first start):
- Survives `docker compose down && up` ✅
- File permissions: `0600` (owner-only read/write)
- Env vars override file values: `RIST_API_KEY`, `SRT_API_KEY`, `RIST_API_URL`, etc.

### Backup & Restore

**Export encrypted backup** (from UI):
1. Open Settings → **Backup** tab
2. Click **Download Backup**, set a password
3. Saves as `ristmonitor-config-*.enc.json`

**Restore from backup:**
1. Settings → **Backup** → choose encrypted file + password
2. All settings restored (restarts ristreceiver instances)

## Configuration

### Via UI Settings Dialog (Tabs)

| Tab | Settings |
|-----|----------|
| **SRT** | SLS API key |
| **RIST** | API URL, API key, server hostname, port visibility toggle, PSK password requirement |
| **UI** | Advanced mode, Developer mode, QR code toggle, Dark mode (future) |
| **Backup** | Export/import encrypted config files |

### Via Environment Variables (Docker)

Set in `.env` or `docker-compose.yml`:

```bash
RIST_API_KEY=your-secret-key        # API authentication for /api/* endpoints
SRT_API_KEY=your-srt-key             # SLS authentication
RIST_API_URL=http://localhost:3001   # RIST API endpoint
RIST_SERVER_HOST=your-server.com     # Hostname for RIST URLs shown in UI
FLOW_HISTORY_TIMEOUT=30              # Seconds before inactive flows move to history
ADVANCED_MODE=false                  # UI option
DEVELOPER_MODE=false                 # Show process logs
```

## RIST Receiver Management

### Create Receiver

1. **Streams** section → **Add Receiver**
2. Set **Stream Name**, **Password (PSK)** (auto-generated or custom)
3. Advanced: custom port (default 5005) and output URL
4. Click **Start Receiver**

The receiver spawns a `ristreceiver` process and listens on the configured UDP port.

### RIST Input URL

Displayed on each receiver card:

```
rist://server-ip:5005?secret=<password>
```

Use in **OBS**, **vMix**, **ffmpeg**, or any RIST-capable encoder.

### SRT Relay (OBS Pull)

For each receiver:
1. Click **SRT** button (green)
2. Enter SRT listen port (default 5002) and optional passphrase
3. Copy **OBS Input Format** URL
4. Paste into OBS → Media Source or Network Stream input

**OBS Input Format:**
```
srt://server-ip:5002?passphrase=<passphrase>&latency=2000000
```

Passphrase is AES-128 encrypted; latency is in microseconds (2 seconds = 2,000,000 μs).

## API Endpoints

### Receivers

```
GET    /api/receivers               List all receivers
POST   /api/receivers               Create receiver { name, listenPort, outputUrl, secret }
PUT    /api/receivers/:id           Update receiver { name, secret, outputUrl }
DELETE /api/receivers/:id           Stop receiver
GET    /api/receivers/:id/stats     Flows for a receiver
GET    /api/receivers/:id/logs      Process logs
```

### Relay (UDP→SRT)

```
POST   /api/receivers/:id/relay     Start relay { srtPort, passphrase }
DELETE /api/receivers/:id/relay     Stop relay
GET    /api/receivers/:id/relay/logs Relay logs
```

### Config Persistence

```
GET    /api/config                  Read persisted config + status
PUT    /api/config                  Update config { srtApiKey, ristApiUrl, ... }
POST   /api/config/export           Export encrypted { password }
POST   /api/config/import           Import encrypted { password, envelope }
```

## Security Notes

- **PSK (Pre-Shared Key)**: 8–64 character passwords required; embedded in RIST URLs
- **SRT Passphrase**: 10–79 characters (AES-128); transmitted encrypted over SRT
- **Config File**: Permissions `0600` on disk; encrypted exports use AES-256-GCM + PBKDF2 (200k iterations)
- **API Key**: Set via env var or UI settings; stored in `/data/config.json` with restricted permissions
- **No auth on `/health`** endpoint (for Docker healthchecks)
- All other `/api/*` endpoints require `X-API-Key` header if `RIST_API_KEY` is set

## Development

### Project Structure

```
UIRist/
├── api/                 # Express RIST API server
│   ├── src/
│   │   ├── receiverManager.js     # ristreceiver spawning + state
│   │   ├── relayManager.js        # srt-live-transmit spawning
│   │   ├── configManager.js       # /data/config.json I/O + encryption
│   │   ├── metricsServer.js       # Unix socket metrics listener
│   │   ├── portManager.js         # iptables auto-opening
│   │   └── logger.js              # JSON logging
│   └── server.js
├── html/                # React + TypeScript UI
│   ├── src/
│   │   ├── contexts/    # Auth, Settings (with backend sync)
│   │   ├── services/    # API clients
│   │   ├── components/  # React components
│   │   └── hooks/       # useRistReceivers, useRistStats, etc.
│   └── public/
├── data/                # Persistent config (created on first start)
├── docker/              # Dockerfiles (prod + dev)
└── docker-compose.yml   # Full stack: rist-api + ui + belabox-receiver
```

### Build & Test

```bash
# Frontend
cd html && npm install && npm run build

# Backend
cd api && npm install && node server.js

# Docker
docker compose --profile dev build
docker compose --profile dev up
```

## Troubleshooting

**"RIST API not available"** → Check `docker compose logs rist-api`, verify `RIST_API_URL` in settings

**"Config load failed"** → Check `/data/config.json` permissions and logs; see Backup tab for error details

**"ristreceiver not found"** → Install librist: `brew install librist` (or use Docker)

**Port already in use** → Change in settings or stop conflicting process

**SRT stream unstable** → Increase buffer in relay settings; check UDP packet loss with `netstat -u`

## License

[OpenIRL/sls-management-ui](https://github.com/OpenIRL/sls-management-ui) — See COPYING
