// GET  /api/data  -> the board, readable by anyone
// PUT  /api/data  -> save the board, needs the edit password in the x-edit-key header
const seed = require('../data/seed.json');
const { KEY, HISTORY_KEY, redisConfig, redis, checkPassword, send, readBody } = require('./_lib');

const MAX_BYTES = 900_000;
const KEEP_VERSIONS = 50;

function isValidDoc(doc) {
  return (
    doc && typeof doc === 'object' &&
    Array.isArray(doc.columns) && Array.isArray(doc.rows) &&
    doc.columns.length <= 60 && doc.rows.length <= 1000 &&
    doc.columns.every((c) => c && typeof c.id === 'string' && typeof c.name === 'string') &&
    doc.rows.every((r) => r && typeof r.id === 'string' && r.cells && typeof r.cells === 'object')
  );
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const store = !!redisConfig();
      const raw = store ? await redis(['GET', KEY]) : null;
      const rec = raw ? JSON.parse(raw) : null;
      return send(res, 200, {
        doc: rec ? rec.doc : seed,
        version: rec ? rec.version : 0,
        updatedAt: rec ? rec.updatedAt : null,
        storage: store ? 'connected' : 'none',
        editingEnabled: store && !!process.env.EDIT_PASSWORD,
      });
    }

    if (req.method === 'PUT') {
      const auth = await checkPassword(req, req.headers['x-edit-key']);
      if (auth.locked) return send(res, 429, { error: 'Too many wrong passwords. Try again in 15 minutes.' });
      if (!auth.ok) return send(res, 401, { error: 'Edit password not accepted.' });
      if (!redisConfig()) return send(res, 503, { error: 'Storage is not connected, so changes cannot be saved. Connect a Redis store (see README).' });

      const body = await readBody(req);
      const doc = body && body.doc;
      if (!isValidDoc(doc)) return send(res, 400, { error: 'The board data is not in the expected shape.' });
      const json = JSON.stringify(doc);
      if (json.length > MAX_BYTES) return send(res, 413, { error: 'The board is too large to save.' });

      const raw = await redis(['GET', KEY]);
      const current = raw ? JSON.parse(raw) : { version: 0 };
      if (typeof body.baseVersion === 'number' && body.baseVersion !== current.version) {
        return send(res, 409, { error: 'The board changed since you opened it.', version: current.version, updatedAt: current.updatedAt });
      }

      const rec = { doc, version: (current.version || 0) + 1, updatedAt: new Date().toISOString() };
      if (raw) {
        await redis(['LPUSH', HISTORY_KEY, raw]);           // keep earlier versions as backups
        await redis(['LTRIM', HISTORY_KEY, '0', String(KEEP_VERSIONS - 1)]);
      }
      await redis(['SET', KEY, JSON.stringify(rec)]);
      return send(res, 200, { version: rec.version, updatedAt: rec.updatedAt });
    }

    res.setHeader('Allow', 'GET, PUT');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: `Server error: ${e.message || 'unknown'}` });
  }
};
