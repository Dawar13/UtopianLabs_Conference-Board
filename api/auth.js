// POST /api/auth  { password }  -> 200 if it is the edit password
const { redisConfig, checkPassword, send, readBody } = require('./_lib');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { error: 'Method not allowed' });
    }
    if (!process.env.EDIT_PASSWORD) {
      return send(res, 503, { error: 'Editing is switched off. Set EDIT_PASSWORD in the Vercel project settings (see README).' });
    }
    const body = await readBody(req);
    const auth = await checkPassword(req, body && body.password);
    if (auth.locked) return send(res, 429, { error: 'Too many wrong passwords. Try again in 15 minutes.' });
    if (!auth.ok) return send(res, 401, { error: 'That password is not right.' });
    return send(res, 200, { ok: true, storage: redisConfig() ? 'connected' : 'none' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: `Server error: ${e.message || 'unknown'}` });
  }
};
