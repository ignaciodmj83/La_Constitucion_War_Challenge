/* =========================================================================
   _kv.js — cliente mínimo de la base de datos (Redis por REST, sin
   dependencias). Compatible con las integraciones de Vercel Marketplace
   (Upstash Redis / Vercel KV): usa las variables de entorno que esas
   integraciones crean automáticamente al conectar la base de datos.
   Los ficheros que empiezan por "_" no se publican como endpoints.
   ========================================================================= */
'use strict';

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

const configured = () => Boolean(URL && TOKEN);

async function cmd(...args) {
  if (!configured()) throw new Error('kv-no-configurado');
  const r = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

module.exports = {
  configured,
  get: (k) => cmd('GET', k),
  set: (k, v) => cmd('SET', k, v),
  exists: (k) => cmd('EXISTS', k),
};
