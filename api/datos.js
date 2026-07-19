/* /api/datos — GET: carga los datos del usuario · POST {datos}: los guarda.
   Requiere Authorization: Bearer <token>. */
'use strict';
const kv = require('./_kv');
const { usuarioDe, cors } = require('./_auth');

const LIMITE = 900000; // ~0,9 MB por usuario, de sobra para las partidas

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!kv.configured()) return res.status(503).json({ error: 'La base de datos no está configurada.' });
  const nombre = usuarioDe(req);
  if (!nombre) return res.status(401).json({ error: 'Sesión no válida o caducada.' });
  try {
    if (req.method === 'GET') {
      const raw = await kv.get('d:' + nombre);
      return res.status(200).json({ ok: true, datos: raw ? JSON.parse(raw) : null });
    }
    if (req.method === 'POST') {
      const datos = (req.body || {}).datos;
      if (!datos || typeof datos !== 'object') return res.status(400).json({ error: 'Faltan los datos.' });
      datos.updated = Date.now();
      const raw = JSON.stringify(datos);
      if (raw.length > LIMITE) return res.status(413).json({ error: 'Datos demasiado grandes.' });
      await kv.set('d:' + nombre, raw);
      return res.status(200).json({ ok: true, updated: datos.updated });
    }
    res.status(405).json({ error: 'método' });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor.' });
  }
};
