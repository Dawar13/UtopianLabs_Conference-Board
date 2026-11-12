// Shared helpers for the API routes. Files starting with "_" are not deployed as routes.
const crypto = require('crypto');

const KEY = process.env.BOARD_KEY || 'conference-board:v1';
const HISTORY_KEY = `${KEY}:history`;
const MAX_FAILS = 10;          // wrong passwords allowed per IP ...
const FAIL_WINDOW_S = 900;     // ... in this many seconds

// In-memory store, used only by scripts/dev.js for local testing.
const mem = new Map();
function memoryRedis([op, key, ...rest]) {
  switch (String(op).toUpperCase()) {
    case 'GET': return mem.has(key) ? mem.get(key) : null;
    case 'SET': mem.set(key, rest[0]); return 'OK';
    case 'DEL': mem.delete(key); return 1;
    case 'INCR': { const v = (Number(mem.get(key)) || 0) + 1; mem.set(key, String(v)); return v; }
    case 'EXPIRE': return 1;
    case 'LPUSH': { const l = mem.get(key) || []; l.unshift(...rest); mem.set(key, l); return l.length; }
    case 'LTRIM': { const l = mem.get(key) || []; mem.set(key, l.slice(Number(rest[0]), Number(rest[1]) + 1)); return 'OK'; }
    default: throw new Error(`Unsupported command ${op}`);
  }
}

// Works with either variable set that the Vercel Marketplace Redis integration injects.
function redisConfig() {
  if (process.env.BOARD_MEMORY_STORE === '1') return { memory: true };
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

async function redis(cmd) {
  const cfg = redisConfig();
  if (!cfg) throw Object.assign(new Error('Storage is not connected'), { code: 'NO_STORE' });
  if (cfg.memory) return memoryRedis(cmd);
  const r = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `Redis responded with ${r.status}`);
  return j.result;
}

function passwordMatches(given) {
  const real = process.env.EDIT_PASSWORD;
  if (!real || typeof given !== 'string' || !given) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xf) ? xf[0] : xf || '').split(',')[0].trim();
  return first || (req.socket && req.socket.remoteAddress) || 'unknown';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Returns { ok, locked }. Counts wrong attempts per IP when storage is connected.
async function checkPassword(req, given) {
  const store = !!redisConfig();
  const failKey = `${KEY}:fail:${clientIp(req)}`;
  if (store) {
    const n = Number(await redis(['GET', failKey])) || 0;
    if (n >= MAX_FAILS) return { ok: false, locked: true };
  }
  if (passwordMatches(given)) return { ok: true };
  if (store) {
    await redis(['INCR', failKey]);
    await redis(['EXPIRE', failKey, String(FAIL_WINDOW_S)]);
  }
  await sleep(500);
  return { ok: false };
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}');
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1_000_000) throw Object.assign(new Error('Request too large'), { code: 'TOO_LARGE' });
    chunks.push(c);
  }
  const s = Buffer.concat(chunks).toString('utf8');
  return s ? JSON.parse(s) : {};
}

module.exports = { KEY, HISTORY_KEY, redisConfig, redis, checkPassword, send, readBody };
