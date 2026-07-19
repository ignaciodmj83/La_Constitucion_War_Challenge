#!/usr/bin/env node
/* =========================================================================
   serve.js — servidor local mínimo para jugar en el navegador.
   No requiere dependencias: solo Node.
   Uso:  npm run serve   →   abre http://localhost:8080
   ========================================================================= */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/* Las funciones de /api (Vercel) también funcionan en local: se montan con
   un pequeño adaptador estilo Vercel (res.status().json()). */
function apiShim(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };
  return res;
}
function serveApi(req, res, urlPath) {
  const name = urlPath.slice(5).replace(/[^a-z]/g, '');
  const file = path.join(ROOT, 'api', name + '.js');
  if (!name || !fs.existsSync(file)) { res.writeHead(404).end('No encontrado'); return; }
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = {}; }
    apiShim(res);
    Promise.resolve(require(file)(req, res)).catch(() => { try { res.status(500).json({ error: 'interno' }); } catch { /* */ } });
  });
}

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.startsWith('/api/')) { serveApi(req, res, urlPath); return; }
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404).end('No encontrado'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`▶ La Constitución: WarChallenge en http://localhost:${PORT}`);
  console.log('  (Ctrl+C para parar)');
});
