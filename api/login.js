/* POST /api/login {nombre, pass} — inicia sesión y devuelve token + datos guardados. */
'use strict';
const kv = require('./_kv');
const { verificaPass, emiteToken, cors, normalizaNombre } = require('./_auth');

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'método' });
  if (!kv.configured()) return res.status(503).json({ error: 'La base de datos no está configurada.' });
  try {
    const nombre = normalizaNombre((req.body || {}).nombre).toLowerCase();
    const pass = String((req.body || {}).pass || '');
    const raw = await kv.get('u:' + nombre);
    if (!raw) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    const u = JSON.parse(raw);
    if (!verificaPass(pass, u)) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    const datosRaw = await kv.get('d:' + nombre);
    res.status(200).json({ ok: true, token: emiteToken(nombre), nombre: u.nombre, datos: datosRaw ? JSON.parse(datosRaw) : null });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor.' });
  }
};
