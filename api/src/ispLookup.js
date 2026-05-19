'use strict';
/**
 * ISP / country lookup with persistent JSON cache.
 *
 * Design goals
 * ─────────────
 *  • Synchronous read path (`lookupSync`) so callers building API responses don't
 *    have to await per peer. First sighting returns null + fires a background fetch.
 *  • Persistent on-disk cache so ISP info survives container restarts.
 *  • Friendly to free-tier upstream limits: provider is ip-api.com (45 req/min,
 *    no auth required). We dedup in-flight requests and skip private ranges.
 *  • Failure-tolerant: a temporary upstream error caches a negative result for
 *    only 1 h so we retry eventually rather than fail-fast forever.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const log = require('./logger');

const CONFIG_DIR = process.env.CONFIG_DIR || '/data';
const CACHE_FILE = path.join(CONFIG_DIR, 'isp-cache.json');

const TTL_OK_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days for successful lookups
const TTL_FAIL_MS = 60 * 60 * 1000;          // 1 h for failed lookups (retry sooner)
const FLUSH_DEBOUNCE_MS = 500;
const REQUEST_TIMEOUT_MS = 4000;

// ip → { isp, country, fetchedAt }   (`isp`/`country` may be null after a failed lookup)
const cache = new Map();
// ip → Promise   (in-flight dedup)
const inflight = new Map();
let flushTimer = null;
let initialized = false;

/**
 * Detect addresses we should never look up upstream:
 *  • RFC1918 / loopback / link-local IPv4
 *  • CGNAT 100.64.0.0/10
 *  • IPv6 loopback / link-local / unique-local
 */
function isPrivateOrSpecial(ip) {
  if (!ip) return true;
  // IPv4 patterns
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true; // 100.64/10 CGNAT
  if (/^169\.254\./.test(ip)) return true; // link-local
  if (/^0\./.test(ip)) return true;
  // IPv6 patterns
  if (ip === '::1') return true;
  if (/^fe80:/i.test(ip)) return true;          // link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return true; // unique-local
  return false;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushCache();
  }, FLUSH_DEBOUNCE_MS);
}

function flushCache() {
  try {
    // Match configManager's pattern: tmp + rename, restrictive permissions
    const tmp = `${CACHE_FILE}.tmp`;
    const serialised = JSON.stringify(Object.fromEntries(cache), null, 0);
    fs.writeFileSync(tmp, serialised, { mode: 0o600 });
    fs.renameSync(tmp, CACHE_FILE);
    fs.chmodSync(CACHE_FILE, 0o600);
  } catch (err) {
    log.warn('ispLookup: failed to flush cache', { error: err.message });
  }
}

function loadCache() {
  initialized = true;
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      log.info('ispLookup: no cache file yet, starting empty', { file: CACHE_FILE });
      return;
    }
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    for (const [ip, entry] of Object.entries(parsed)) {
      if (entry && typeof entry === 'object') cache.set(ip, entry);
    }
    log.info('ispLookup: cache loaded', { file: CACHE_FILE, entries: cache.size });
  } catch (err) {
    log.warn('ispLookup: failed to load cache, starting empty', { error: err.message });
  }
}

function isExpired(entry) {
  if (!entry || typeof entry.fetchedAt !== 'number') return true;
  const age = Date.now() - entry.fetchedAt;
  const ttl = entry.isp ? TTL_OK_MS : TTL_FAIL_MS;
  return age >= ttl;
}

function fetchFromProvider(ip) {
  if (inflight.has(ip)) return inflight.get(ip);
  const promise = new Promise((resolve) => {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=isp,country,countryCode,status,message`;
    const req = http.get(url, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = null; }
        if (parsed && parsed.status === 'success') {
          const entry = {
            isp: parsed.isp || null,
            country: parsed.countryCode || null, // ISO-2; UI builds flag emoji from this
            fetchedAt: Date.now(),
          };
          cache.set(ip, entry);
          scheduleFlush();
          resolve(entry);
        } else {
          const entry = { isp: null, country: null, fetchedAt: Date.now() };
          cache.set(ip, entry);
          scheduleFlush();
          log.warn('ispLookup: upstream returned error', { ip, message: parsed?.message });
          resolve(entry);
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (err) => {
      // Don't poison the cache on transient network errors — short-TTL the failure.
      const entry = { isp: null, country: null, fetchedAt: Date.now() };
      cache.set(ip, entry);
      scheduleFlush();
      log.warn('ispLookup: fetch failed', { ip, error: err.message });
      resolve(entry);
    });
  }).finally(() => { inflight.delete(ip); });

  inflight.set(ip, promise);
  return promise;
}

/**
 * Synchronous lookup. Returns whatever's cached (even a stale-but-not-yet-expired
 * entry) or null. If nothing is cached or the entry has expired, schedules a
 * background fetch so the next call sees a fresh value.
 *
 * Returns: `{ isp: string|null, country: string|null }` or `null` (call site
 * should treat null as "not yet known").
 */
function lookupSync(ip) {
  if (!ip) return null;

  if (isPrivateOrSpecial(ip)) {
    return { isp: 'Private/LAN', country: null };
  }

  const cached = cache.get(ip);
  if (cached && !isExpired(cached)) {
    return { isp: cached.isp, country: cached.country };
  }

  // No usable cache → start a fetch in the background. The current request
  // returns null; the next /api/stats poll (a few seconds later) will see the
  // populated value.
  if (!inflight.has(ip)) {
    fetchFromProvider(ip).catch(() => {}); // already handled inside
  }

  // Serve a stale entry if we have one — better than nothing while the refresh runs.
  if (cached) return { isp: cached.isp, country: cached.country };
  return null;
}

module.exports = {
  loadCache,
  flushCache,
  lookupSync,
  isPrivateOrSpecial,
  // exported for tests / debugging
  _cache: cache,
  CACHE_FILE,
};
