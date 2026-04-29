'use strict';
const rateLimit = require('express-rate-limit');

// 10 receiver creations per minute per IP — prevents fork-bomb attacks
// since each receiver spawns a ristreceiver process.
const createReceiverLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: 'Too many receiver creation requests, please wait.' },
});

module.exports = { createReceiverLimiter };
