'use strict';
// RISTMonitor API server — entrypoint.
// Concerns are split into:
//   src/middleware/  cross-cutting (cors, auth, logging, rate limits)
//   src/routes/      route handlers, one file per resource
//   src/validators/  payload validation helpers
//   src/{receiver,relay,config,port,metrics}Manager.js  domain logic
//
// This file only handles wireup, startup, and process lifecycle.

const express = require('express');
const log = require('./src/logger');
const { openPort } = require('./src/portManager');
const { getBinaryStatus } = require('./src/receiverManager');
const configManager = require('./src/configManager');
const { getActiveApiKey } = require('./src/middleware/auth');

const cors = require('./src/middleware/cors');
const requestLogger = require('./src/middleware/requestLogger');

const healthRoutes = require('./src/routes/health');
const portRoutes = require('./src/routes/ports');
const receiverRoutes = require('./src/routes/receivers');
const relayRoutes = require('./src/routes/relay');
const statsRoutes = require('./src/routes/stats');
const configRoutes = require('./src/routes/config');

// Load persisted config first — env vars override file values via configManager.
const { error: configLoadError } = configManager.loadConfig();
if (configLoadError) {
  log.error('Config load failed at startup', { error: configLoadError });
}

const app = express();
const PORT = process.env.RIST_API_PORT || 3001;

// ── Cross-cutting middleware ────────────────────────────────────────────
app.use(express.json());
app.use(cors);
app.use(requestLogger);

// ── Routes ──────────────────────────────────────────────────────────────
app.use(healthRoutes);
app.use(portRoutes);
app.use(receiverRoutes);
app.use(relayRoutes);
app.use(statsRoutes);
app.use(configRoutes);

// ── Start ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const bin = getBinaryStatus();
  log.info('RISTMonitor API Server started', {
    port: PORT,
    ristreceiver: bin.available ? bin.path : 'NOT FOUND',
    auth: getActiveApiKey() ? 'enabled' : 'disabled',
    configFile: configManager.CONFIG_FILE,
    configError: configLoadError || 'none',
    cors: process.env.CORS_ORIGIN || '*',
  });
  openPort(PORT, 'tcp'); // open API port in iptables automatically
});
