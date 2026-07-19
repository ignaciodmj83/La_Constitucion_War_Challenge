/* POST /api/registro {nombre, pass} — crea la cuenta y devuelve el token. */
'use strict';
const kv = require('./_kv');
const { nuevaCredencial, emiteToken, cors, normalizaNombre, nombreValido } = require('./_auth');

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'método' });
  if (!kv.configured()) return res.status(503).json({ error: 'La base de datos no está configurada.' });
  try {
    const nombre = normalizaNombre((req.body || {}).nombre);
    const pass = String((req.body || {}).pass || '');
    if (!nombreValido(nombre)) return res.status(400).json({ error: 'Nombre no válido (3 a 20 caracteres).' });
    if (pass.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
    const clave = 'u:' + nombre.toLowerCase();
    if (await kv.exists(clave)) return res.status(409).json({ error: 'Ese nombre ya está registrado. Prueba a entrar.' });
    const cred = nuevaCredencial(pass);
    await kv.set(clave, JSON.stringify({ nombre, ...cred, created: Date.now() }));
    res.status(200).json({ ok: true, token: emiteToken(nombre.toLowerCase()), nombre });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor.' });
  }
};
