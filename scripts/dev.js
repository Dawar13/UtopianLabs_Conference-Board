// Local preview without Vercel: node scripts/dev.js, then open http://localhost:3000
// Uses an in-memory store (resets when you stop it). Edit password: change-me (or set EDIT_PASSWORD).
process.env.BOARD_MEMORY_STORE = process.env.BOARD_MEMORY_STORE || '1';
process.env.EDIT_PASSWORD = process.env.EDIT_PASSWORD || 'change-me';

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const routes = { '/api/data': require('../api/data.js'), '/api/auth': require('../api/auth.js') };
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT) || 3000;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (routes[url.pathname]) return routes[url.pathname](req, res);
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  const blocked = !file.startsWith(root + path.sep) || /^(api|scripts)[\\/]/.test(path.relative(root, file));
  if (blocked) { res.statusCode = 404; return res.end('Not found'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(buf);
  });
}).listen(port, () => console.log(`Board running at http://localhost:${port} (edit password: ${process.env.EDIT_PASSWORD})`));
