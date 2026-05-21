'use strict';
const express = require('express');
const { auth } = require('../middleware/auth');
const { getAllFlows, getReceiverFlows, receivers } = require('../receiverManager');

const router = express.Router();

router.get('/api/stats', auth, (req, res) => {
  res.json({ flows: getAllFlows() });
});

router.get('/api/receivers/:id/stats', auth, (req, res) => {
  const rec = receivers.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });
  res.json({ flows: getReceiverFlows(req.params.id) });
});

// NOALBS OpenIRL-compatible stats endpoint.
// NOALBS polls the URL plain (no auth header support), reads `publisher` and
// deserializes { bitrate(Kbps), buffer, dropped_pkts, latency(ms), rtt(ms), uptime(s) }.
// A missing `publisher` field means the stream is offline.
// Matched against the ristreceiver flow stats for the receiver whose id (with
// or without dashes) equals the stream key after the `play_` prefix.
function findReceiverByStreamKey(key) {
  if (!key) return null;
  if (receivers.has(key)) return receivers.get(key);
  const normalized = key.toLowerCase();
  for (const rec of receivers.values()) {
    if (rec.id.replace(/-/g, '').toLowerCase() === normalized) return rec;
  }
  return null;
}

// `-S 2000` is passed to ristreceiver in startReceiver — this is the static buffer size in ms.
const RIST_BUFFER_MS = 2000;

router.get('/stats/play_:streamKey', (req, res) => {
  const rec = findReceiverByStreamKey(req.params.streamKey);
  // Always 200 so NOALBS treats a missing publisher as "offline" instead of erroring.
  if (!rec || rec.status !== 'running') return res.json({});

  const flows = getReceiverFlows(rec.id);
  const flow = flows[0];
  if (!flow) return res.json({});

  const activePeers = (flow.peers || []).filter(p => p.dead === 0);
  const rttSource = activePeers.length ? activePeers : flow.peers || [];
  const avgRtt = rttSource.length
    ? rttSource.reduce((sum, p) => sum + (Number(p.rtt) || 0), 0) / rttSource.length
    : 0;

  const uptimeSec = rec.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(rec.createdAt).getTime()) / 1000))
    : 0;

  res.json({
    publisher: {
      bitrate: Math.round((flow.bitrate || 0) / 1000),
      buffer: Math.round(flow.avgBufferTime || 0),
      dropped_pkts: flow.packetsLost || 0,
      latency: RIST_BUFFER_MS,
      rtt: Math.round(avgRtt * 100) / 100,
      uptime: uptimeSec,
    },
  });
});

module.exports = router;
