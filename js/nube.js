/* =========================================================================
   NUBE — cliente de la cuenta en el servidor (funciones /api de Vercel).
   - Registro e inicio de sesión con usuario y contraseña.
   - Guarda y recupera las partidas del usuario en la base de datos, para
     jugar desde cualquier dispositivo con la misma cuenta.
   - Autoguardado con acumulación (throttle) y reintento silencioso.
   Si el backend no está desplegado o la BBDD no está conectada, el juego
   sigue funcionando en modo local sin cambios.
   ========================================================================= */
'use strict';
(function () {
  const KEY = 'ce78_nube_v1';
  const API = 'api/';
  let st = null;
  try { st = JSON.parse(localStorage.getItem(KEY)); } catch { /* */ }
  const guardaSt = () => { try { st ? localStorage.setItem(KEY, JSON.stringify(st)) : localStorage.removeItem(KEY); } catch { /* */ } };

  let listo = null; // null = sin comprobar; true/false tras /api/salud
  async function disponible() {
    if (listo !== null) return listo;
    try {
      const r = await fetch(API + 'salud', { cache: 'no-store' });
      const j = await r.json();
      listo = Boolean(j.ok && j.listo);
    } catch { listo = false; }
    return listo;
  }

  async function llama(ruta, opciones = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (st && st.token) headers.Authorization = 'Bearer ' + st.token;
    const r = await fetch(API + ruta, { headers, ...opciones });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && st) { st = null; guardaSt(); } // sesión caducada
    if (!r.ok) throw new Error(j.error || 'Error de conexión.');
    return j;
  }

  const sesion = () => (st && st.token ? { nombre: st.nombre } : null);

  async function registro(nombre, pass) {
    const j = await llama('registro', { method: 'POST', body: JSON.stringify({ nombre, pass }) });
    st = { token: j.token, nombre: j.nombre }; guardaSt();
    return null; // cuenta nueva: sin datos previos
  }
  async function login(nombre, pass) {
    const j = await llama('login', { method: 'POST', body: JSON.stringify({ nombre, pass }) });
    st = { token: j.token, nombre: j.nombre }; guardaSt();
    return j.datos || null;
  }
  function logout() { st = null; guardaSt(); }

  async function cargar() { return (await llama('datos')).datos; }

  /* subida bloqueante: hay que esperarla antes de recargar la página, para
     que la siguiente carga no lea datos del servidor aún desactualizados. */
  async function subir(datos) {
    if (!sesion()) return;
    await llama('datos', { method: 'POST', body: JSON.stringify({ datos }) });
  }

  /* autoguardado acumulado: como mucho una subida cada 10 s */
  let pendiente = null, timer = null, ultimo = 0, estado = 'inactivo';
  function push(datos) {
    if (!sesion()) return;
    pendiente = datos;
    const espera = Math.max(0, 10000 - (Date.now() - ultimo));
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      const d = pendiente; pendiente = null; ultimo = Date.now();
      try { estado = 'guardando'; await llama('datos', { method: 'POST', body: JSON.stringify({ datos: d }) }); estado = 'ok'; }
      catch { estado = 'error'; }
    }, espera);
  }
  /* subida inmediata sin esperar respuesta (al salir de la página) */
  function pushAhora(datos) {
    if (!sesion()) return;
    try {
      fetch(API + 'datos', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + st.token },
        body: JSON.stringify({ datos }),
      });
    } catch { /* */ }
  }

  window.NUBE = { disponible, sesion, registro, login, logout, cargar, subir, push, pushAhora, estado: () => estado };
})();
