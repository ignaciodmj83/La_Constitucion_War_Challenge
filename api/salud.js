/* GET /api/salud — ¿está el backend disponible y la BBDD conectada? */
'use strict';
const kv = require('./_kv');
const { cors } = require('./_auth');

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.status(200).json({ ok: true, listo: kv.configured() });
};
