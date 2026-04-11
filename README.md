# UIRist

Combined management UI for **SRT Live Server** and **RIST** streams. Based on [OpenIRL/sls-management-ui](https://github.com/OpenIRL/sls-management-ui), extended with a full RIST receiver management stack.

## Features

- **SRT**: Manage publishers and stream IDs via SLS API
- **RIST**: Create/stop `ristreceiver` instances, monitor live flows
- Service selection on first launch — use SRT, RIST, or both independently
- Per-flow stats: quality, bitrate, buffer time, peer connections with RTT
- Copy-to-clipboard for RIST input URLs (for OBS/Moblin)

## Requirements

- [librist](https://code.videolan.org/rist/librist) — `brew install librist`
- Node.js 18+

## Setup

```bash
# 1. Install dependencies
npm install --prefix html
npm install --prefix api

# 2. Start the RIST API server
node api/server.js

# 3. Start the UI
npm start --prefix html
```

Open `http://localhost:3000`, select your services, configure settings.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| SRT API Key | — | SLS API key for authentication |
| RIST API URL | `http://localhost:3001` | URL of the RIST API server |

## RIST API

The Express server (`api/server.js`) wraps `ristreceiver` and exposes:

```
GET    /api/receivers          List all receivers
POST   /api/receivers          Start a new receiver { name, listenPort, outputUrl }
DELETE /api/receivers/:id      Stop a receiver
GET    /api/stats              Aggregated flow stats (all receivers)
GET    /api/receivers/:id/logs Process logs
```

## Connecting a sender

After creating a receiver on e.g. port 5005, the RIST input URL shown in the UI is:

```
rist://<server-ip>:5005
```

Enter this in **Moblin**, **OBS** (RIST output plugin), or any RIST-capable encoder.
