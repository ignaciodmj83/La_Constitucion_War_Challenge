/* =========================================================================
   _auth.js — utilidades de autenticación (sin dependencias).
   - Contraseñas: scrypt con salt aleatorio (crypto de Node).
   - Sesión: token firmado con HMAC-SHA256 (SESSION_SECRET) y caducidad.
   - CORS y helpers comunes de los endpoints.
   ========================================================================= */
'use strict';
const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || 'ce78-dev';
const DIAS_SESION = 90;

const b64u = (s) => Buffer.from(s, 'utf8').toString('base64url');
const unb64u = (s) => Buffer.from(s, 'base64url').toString('utf8');
const firma = (payload) => crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');

function hashPass(pass, salt) {
  return crypto.scryptSync(String(pass), salt, 32).toString('hex');
}
function nuevaCredencial(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: hashPass(pass, salt) };
}
function verificaPass(pass, cred) {
  try {
    const a = Buffer.from(hashPass(pass, cred.salt), 'hex');
    const b = Buffer.from(cred.hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

function emiteToken(nombre) {
  const exp = Date.now() + DIAS_SESION * 86400000;
  const payload = `${b64u(nombre)}.${exp}`;
  return `${payload}.${firma(payload)}`;
}
function verificaToken(token) {
  try {
    const [n, exp, sig] = String(token || '').split('.');
    const payload = `${n}.${exp}`;
    if (firma(payload) !== sig) return null;
    if (Date.now() > Number(exp)) return null;
    return unb64u(n);
  } catch { return null; }
}
function usuarioDe(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? verificaToken(m[1]) : null;
}

/* CORS abierto (los datos siempre van protegidos por token). Devuelve true
   si la petición era el preflight OPTIONS y ya quedó respondida. */
function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

const normalizaNombre = (n) => String(n || '').trim().replace(/\s+/g, ' ');
const nombreValido = (n) => /^[\wáéíóúüñÁÉÍÓÚÜÑ][\wáéíóúüñÁÉÍÓÚÜÑ .-]{2,19}$/.test(n);

module.exports = { nuevaCredencial, verificaPass, emiteToken, verificaToken, usuarioDe, cors, normalizaNombre, nombreValido };
