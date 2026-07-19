/* =========================================================================
   CUENTA — sesión única en la nube (login o crear cuenta) y gestor de
   partidas de la cuenta.
   - No hay perfiles locales ni PIN de dispositivo: para jugar hace falta
     iniciar sesión o crear una cuenta en el servidor.
   - Cada cuenta guarda varias partidas (nueva/abrir/eliminar); cambiar de
     partida intercambia los datos guardados de los 5 juegos (snapshot/
     restauración de sus claves de localStorage) y recarga.
   - Al arrancar, si ya hay sesión, se revalida contra el servidor: si hay
     una versión más reciente (jugada desde otro dispositivo) se aplica y
     se recarga; si no, se sigue con lo que ya había en este dispositivo.
   Debe cargarse ANTES de game.js, y después de nube.js.
   ========================================================================= */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const CACHE_KEY = 'ce78_cuenta_v2';
  const GAME_KEYS = ['ce78_warchallenge_v3', 'ce78_memoria_v2', 'ce78_tribunal_v1', 'ce78_trivial_v1', 'ce78_islas_v1'];

  let ST = null; // { nombre, partidas: [{id,name,created,updated,data}], activa }

  function loadCache() {
    try { const d = JSON.parse(localStorage.getItem(CACHE_KEY)); if (d && d.nombre && Array.isArray(d.partidas)) return d; } catch { /* */ }
    return null;
  }
  function saveCache() { try { ST ? localStorage.setItem(CACHE_KEY, JSON.stringify(ST)) : localStorage.removeItem(CACHE_KEY); } catch { /* */ } }
  ST = loadCache();

  const nextId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function snapshot() { const d = {}; for (const k of GAME_KEYS) { const v = localStorage.getItem(k); if (v != null) d[k] = v; } return d; }
  function writeLive(data) { for (const k of GAME_KEYS) { if (data && data[k] != null) localStorage.setItem(k, data[k]); else localStorage.removeItem(k); } }
  function resumen(data) {
    try {
      const s = JSON.parse((data || {})['ce78_warchallenge_v3'] || 'null');
      if (!s) return '· partida nueva';
      return `🗺️ ${Object.keys(s.owned || {}).length}/169 · 🏅 ${Math.round(s.score || 0).toLocaleString('es-ES')}`;
    } catch { return ''; }
  }

  const partidasOrden = () => (ST.partidas || []).slice().sort((a, b) => b.updated - a.updated);
  const activa = () => (ST.partidas || []).find((p) => p.id === ST.activa);
  function nuevaPartidaObj(data) {
    const num = (ST.partidas || []).length + 1;
    const p = { id: nextId(), name: `Partida ${num}`, created: Date.now(), updated: Date.now(), data: data || null };
    ST.partidas.push(p);
    return p;
  }
  const paquete = () => ({ partidas: ST.partidas, activa: ST.activa });

  /* Mientras hay un cambio de partida/sesión en marcha (hasta la recarga),
     queda PROHIBIDO volver a guardar: la S en memoria de los juegos aún es
     de la partida anterior, y un save() tardío (intervalo, unload) la
     volcaría al localStorage recién limpiado, contaminando la partida nueva. */
  let congelado = false;
  function prepararCambio() {
    congelado = true;
    try { window.save = function () { /* anulado hasta recargar */ }; } catch { /* */ }
  }
  function guardaActiva() {
    if (!ST || congelado) return;
    try { if (typeof save === 'function') save(); } catch { /* */ }
    const p = activa(); if (!p) return;
    p.data = snapshot(); p.updated = Date.now();
    saveCache();
    NUBE.push(paquete());
  }

  function aplicarDatos(nombre, datos, previaLocal) {
    ST = { nombre, partidas: [], activa: null };
    if (datos && Array.isArray(datos.partidas) && datos.partidas.length) {
      ST.partidas = datos.partidas;
      ST.activa = datos.activa && ST.partidas.some((p) => p.id === datos.activa) ? datos.activa : ST.partidas[0].id;
    } else {
      const seed = previaLocal && Object.keys(previaLocal).length ? previaLocal : null;
      ST.activa = nuevaPartidaObj(seed).id;
    }
    saveCache();
    writeLive(activa().data);
  }

  /* ── acciones de sesión ── */
  async function iniciar(nombre, pass, crear) {
    const previaLocal = crear ? snapshot() : null; // al crear cuenta, rescata el progreso ya jugado en este dispositivo
    const datos = crear ? await NUBE.registro(nombre, pass) : await NUBE.login(nombre, pass);
    prepararCambio(); // los datos restaurados no deben ser pisados por un save() tardío
    aplicarDatos(NUBE.sesion().nombre, datos, previaLocal);
    location.reload();
  }
  async function cerrarSesion() {
    guardaActiva();
    prepararCambio();
    try { await NUBE.subir(paquete()); } catch { /* */ }
    NUBE.logout();
    localStorage.removeItem(CACHE_KEY);
    GAME_KEYS.forEach((k) => localStorage.removeItem(k));
    location.reload();
  }

  /* ── partidas ──
     Tras cambiar qué partida está activa (crear/abrir/eliminar la activa) hay
     que ESPERAR a que el servidor confirme el guardado antes de recargar: si
     recargásemos con la subida aún en vuelo, la comprobación del arranque
     podría leer datos viejos del servidor y deshacer el cambio. */
  async function subirYRecargar() {
    prepararCambio();
    try { await NUBE.subir(paquete()); } catch { /* sin conexión: seguimos con lo local */ }
    location.reload();
  }
  function nuevaPartida() {
    guardaActiva();
    ST.activa = nuevaPartidaObj(null).id;
    writeLive(null); saveCache();
    subirYRecargar();
  }
  function abrirPartida(pid) {
    if (!ST.partidas.some((p) => p.id === pid) || pid === ST.activa) return;
    guardaActiva();
    ST.activa = pid; writeLive(activa().data); saveCache();
    subirYRecargar();
  }
  function eliminarPartida(pid) {
    const p = ST.partidas.find((x) => x.id === pid); if (!p) return;
    if (!confirm(`¿Eliminar «${p.name}»? Se pierde su progreso para siempre.`)) return;
    const eraActiva = pid === ST.activa;
    ST.partidas = ST.partidas.filter((x) => x.id !== pid);
    if (eraActiva) {
      if (!ST.partidas.length) nuevaPartidaObj(null);
      ST.activa = ST.partidas[0].id;
      writeLive(activa().data); saveCache();
      subirYRecargar(); return;
    }
    saveCache(); NUBE.push(paquete()); renderCuenta();
  }

  const esc = (s) => String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');

  /* ── UI: Mi cuenta ── */
  function pintaMenu() { const el = $('menuCuentaName'); if (el && ST) el.textContent = ST.nombre; }
  function openCuenta() { if (!ST) return; renderCuenta(); $('cuentaModal').hidden = false; }

  function renderCuenta() {
    const body = $('cuentaBody'); if (!ST || !body) return;
    const lista = partidasOrden().map((p) => `
      <div class="cta-partida ${p.id === ST.activa ? 'activa' : ''}">
        <div class="cta-p-info"><b>${esc(p.name)}</b><small>${p.id === ST.activa ? '▶ en curso · ' : ''}${resumen(p.id === ST.activa ? snapshot() : p.data)}</small></div>
        <div class="cta-p-btns">
          ${p.id === ST.activa ? '' : `<button class="cta-btn" data-abrir="${p.id}">📂 Abrir</button>`}
          <button class="cta-btn peligro" data-borrar="${p.id}" title="Eliminar partida">🗑️</button>
        </div>
      </div>`).join('');
    body.innerHTML = `
      <div class="cta-user">
        <span class="cta-avatar">☁️</span>
        <div class="cta-u-txt"><b>${esc(ST.nombre)}</b><small>cuenta en la nube · disponible en cualquier dispositivo</small></div>
      </div>
      <div class="cta-row"><button id="ctaPrefs" class="cta-btn cta-full">⚙️ Preferencias</button></div>
      <h3 class="cta-h">🎮 Mis partidas</h3>
      <div class="cta-partidas">${lista}</div>
      <button id="ctaNueva" class="secondary-btn cta-full">➕ Nueva partida</button>
      <div class="cta-foot">
        <button id="ctaSalir" class="cta-btn cta-salir">🚪 Cerrar sesión</button>
        <button id="ctaAyuda" class="cta-link">❓ Cómo se juega</button>
      </div>`;
    body.querySelectorAll('[data-abrir]').forEach((b) => b.addEventListener('click', () => abrirPartida(b.dataset.abrir)));
    body.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', () => eliminarPartida(b.dataset.borrar)));
    $('ctaNueva').addEventListener('click', nuevaPartida);
    $('ctaPrefs').addEventListener('click', () => { if (typeof renderSettings === 'function') { renderSettings(); $('settingsModal').hidden = false; } });
    $('ctaSalir').addEventListener('click', () => { if (confirm('¿Cerrar sesión? Tu progreso queda guardado en la nube.')) cerrarSesion(); });
    $('ctaAyuda').addEventListener('click', () => { $('introModal').hidden = false; });
  }

  /* ── UI: acceso (login / crear cuenta) ── */
  function renderCargando(texto) {
    const body = $('loginBody'); if (!body) return;
    body.innerHTML = `<p class="login-sub" style="text-align:center;padding:28px 0;">⏳ ${esc(texto || 'Conectando con tu cuenta…')}</p>`;
  }
  function renderSinConexion() {
    const body = $('loginBody'); if (!body) return;
    body.innerHTML = `
      <h3 class="cta-h">⚠️ Sin conexión con el servidor</h3>
      <p class="login-sub">No se ha podido conectar con la cuenta en la nube. Comprueba tu conexión e inténtalo de nuevo.</p>
      <button id="gateRetry" class="primary-btn cta-full">🔄 Reintentar</button>`;
    $('gateRetry').addEventListener('click', arrancar);
  }
  function renderGate(msg) {
    const body = $('loginBody'); if (!body) return;
    body.innerHTML = `
      <h3 class="cta-h">☁️ Tu cuenta</h3>
      <p class="login-sub">Entra con tu cuenta o crea una nueva para guardar tu progreso y jugar desde cualquier dispositivo.</p>
      <div class="cta-form">
        <label>Usuario<input id="nubeNombre" type="text" maxlength="20" autocomplete="username" placeholder="Tu nombre de usuario"></label>
        <label>Contraseña<input id="nubePass" type="password" autocomplete="current-password" placeholder="mínimo 4 caracteres"></label>
        <div id="nubeErr" class="cta-err" ${msg ? '' : 'hidden'}>${esc(msg || '')}</div>
        <div class="cta-row">
          <button id="nubeEntrar" class="primary-btn cta-mitad">Entrar</button>
          <button id="nubeCrear" class="cta-btn cta-mitad">Crear cuenta</button>
        </div>
      </div>`;
    const err = (m) => { const e = $('nubeErr'); e.textContent = m; e.hidden = false; };
    const accion = async (crear) => {
      const nombre = $('nubeNombre').value.trim(), pass = $('nubePass').value;
      if (!nombre) { $('nubeNombre').focus(); return; }
      if (pass.length < 4) return err('La contraseña debe tener al menos 4 caracteres.');
      $('nubeEntrar').disabled = true; $('nubeCrear').disabled = true;
      try { await iniciar(nombre, pass, crear); }
      catch (e2) { err(e2.message); $('nubeEntrar').disabled = false; $('nubeCrear').disabled = false; }
    };
    $('nubeEntrar').addEventListener('click', () => accion(false));
    $('nubeCrear').addEventListener('click', () => accion(true));
    $('nubePass').addEventListener('keydown', (e2) => { if (e2.key === 'Enter') accion(false); });
  }
  async function mostrarPuerta(msg) {
    $('gameMenu').hidden = true;
    const ok = await NUBE.disponible();
    if (!ok) { renderSinConexion(); $('loginModal').hidden = false; return; }
    renderGate(msg); $('loginModal').hidden = false;
  }

  /* ── arranque ── */
  async function arrancar() {
    $('gameMenu').hidden = true;
    renderCargando(); $('loginModal').hidden = false;

    if (!NUBE.sesion()) { await mostrarPuerta(); return; }

    const ok = await NUBE.disponible();
    if (!ok) {
      if (ST) { pintaMenu(); $('loginModal').hidden = true; $('gameMenu').hidden = false; return; }
      renderSinConexion(); return;
    }
    let datos;
    try { datos = await NUBE.cargar(); }
    catch (e) {
      if (ST) { pintaMenu(); $('loginModal').hidden = true; $('gameMenu').hidden = false; return; }
      NUBE.logout();
      await mostrarPuerta('No se pudo recuperar tu sesión. Vuelve a entrar.');
      return;
    }
    if (datos) {
      const nuevo = JSON.stringify({ partidas: datos.partidas || null, activa: datos.activa || null });
      const actual = ST ? JSON.stringify({ partidas: ST.partidas, activa: ST.activa }) : null;
      if (nuevo !== actual) { prepararCambio(); aplicarDatos(NUBE.sesion().nombre, datos); location.reload(); return; }
    } else if (!ST) {
      aplicarDatos(NUBE.sesion().nombre, null);
    } else {
      NUBE.pushAhora(paquete()); // el servidor aún no tiene nada: sube lo que hay en este dispositivo
    }
    pintaMenu(); $('loginModal').hidden = true; $('gameMenu').hidden = false;
  }

  /* ── guardado periódico de la partida activa ── */
  setInterval(() => { if (ST) guardaActiva(); }, 30000);
  const alSalir = () => { if (ST) { guardaActiva(); NUBE.pushAhora(paquete()); } };
  window.addEventListener('pagehide', alSalir);
  window.addEventListener('beforeunload', alSalir);

  document.addEventListener('DOMContentLoaded', () => {
    const btn = $('menuCuenta');
    if (btn) btn.addEventListener('click', openCuenta);
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.card-close');
      if (b && b.dataset.close) { const m = $(b.dataset.close); if (m) m.hidden = true; }
    });
  });

  arrancar();

  window.CUENTA = {
    user: () => (ST ? { name: ST.nombre } : null),
    guardaActiva,
    todasLasPartidas: () => (ST ? ST.partidas : []),
    partidaActivaId: () => (ST ? ST.activa : null),
    partidaActivaNombre: () => { const p = ST && activa(); return p ? p.name : ''; },
  };
})();
