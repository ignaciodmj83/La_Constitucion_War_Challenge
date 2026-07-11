/* =========================================================================
   CUENTA — base de datos local de usuarios y partidas + autenticación.
   - Usuarios con nombre y PIN opcional (4 dígitos, guardado con hash).
   - Cada usuario tiene sus partidas; una es la activa. Cambiar de partida
     o de usuario intercambia los datos guardados de los 4 juegos
     (snapshot/restauración de sus claves de localStorage) y recarga.
   - El botón "Mi cuenta" (menú principal) reúne: partidas (nueva/abrir/
     eliminar), cambio de usuario, Ajustes y "Cómo se juega".
   Debe cargarse ANTES de game.js. Sin dependencias.
   ========================================================================= */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const DB_KEY = 'ce78_cuentas_v1';
  const GAME_KEYS = ['ce78_warchallenge_v3', 'ce78_memoria_v2', 'ce78_tribunal_v1', 'ce78_trivial_v1'];

  function loadDB() {
    try { const d = JSON.parse(localStorage.getItem(DB_KEY)); if (d && d.usuarios && d.partidas) return d; } catch { /* */ }
    return { usuarios: {}, partidas: {}, sesion: null, seq: 1 };
  }
  const DB = loadDB();
  const saveDB = () => { try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch { /* */ } };
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return 'h' + h.toString(36); };
  const nextId = (pfx) => pfx + (DB.seq++);

  /* ── snapshot/restauración de los datos de los 4 juegos ── */
  function snapshot() { const d = {}; for (const k of GAME_KEYS) { const v = localStorage.getItem(k); if (v != null) d[k] = v; } return d; }
  function writeLive(data) { for (const k of GAME_KEYS) { if (data && data[k] != null) localStorage.setItem(k, data[k]); else localStorage.removeItem(k); } }
  function resumen(data) {
    try {
      const s = JSON.parse((data || {})['ce78_warchallenge_v3'] || 'null');
      if (!s) return '· partida nueva';
      return `🗺️ ${Object.keys(s.owned || {}).length}/169 · 🏅 ${Math.round(s.score || 0).toLocaleString('es-ES')}`;
    } catch { return ''; }
  }

  const user = () => (DB.sesion && DB.usuarios[DB.sesion]) || null;
  const partidasDe = (uid) => Object.values(DB.partidas).filter((p) => p.uid === uid).sort((a, b) => b.updated - a.updated);

  function nuevaPartidaObj(uid, data) {
    const id = nextId('p');
    const num = partidasDe(uid).length + 1;
    DB.partidas[id] = { id, uid, name: `Partida ${num}`, created: Date.now(), updated: Date.now(), data: data || null };
    return DB.partidas[id];
  }
  /* Vuelca el estado vivo de los juegos en la partida activa del usuario. */
  function guardaActiva() {
    const u = user(); if (!u || !u.activa || !DB.partidas[u.activa]) return;
    try { if (typeof save === 'function') save(); } catch { /* */ }
    const p = DB.partidas[u.activa];
    p.data = snapshot(); p.updated = Date.now();
    saveDB();
  }

  /* Primer arranque: se adopta la partida existente bajo un usuario Invitado. */
  (function boot() {
    if (user()) return;
    let uid = Object.keys(DB.usuarios)[0];
    if (!uid) {
      uid = nextId('u');
      DB.usuarios[uid] = { id: uid, name: 'Invitado', pin: null, activa: null, created: Date.now() };
    }
    DB.sesion = uid;
    const u = DB.usuarios[uid];
    if (!u.activa || !DB.partidas[u.activa]) u.activa = nuevaPartidaObj(uid, snapshot()).id;
    saveDB();
  })();

  /* ── acciones ── */
  function nuevaPartida() {
    guardaActiva();
    const u = user();
    u.activa = nuevaPartidaObj(u.id, null).id;
    writeLive(null); saveDB(); location.reload();
  }
  function abrirPartida(pid) {
    const u = user(); if (!DB.partidas[pid] || DB.partidas[pid].uid !== u.id || pid === u.activa) return;
    guardaActiva();
    u.activa = pid; writeLive(DB.partidas[pid].data); saveDB(); location.reload();
  }
  function eliminarPartida(pid) {
    const u = user(); const p = DB.partidas[pid]; if (!p || p.uid !== u.id) return;
    if (!confirm(`¿Eliminar «${p.name}»? Se pierde su progreso para siempre.`)) return;
    const eraActiva = u.activa === pid;
    delete DB.partidas[pid];
    if (eraActiva) {
      const resto = partidasDe(u.id);
      u.activa = resto.length ? resto[0].id : nuevaPartidaObj(u.id, null).id;
      writeLive(DB.partidas[u.activa].data); saveDB(); location.reload(); return;
    }
    saveDB(); renderCuenta();
  }
  function entrar(uid) {
    if (uid === DB.sesion) { $('loginModal').hidden = true; return; }
    guardaActiva();
    DB.sesion = uid;
    const u = DB.usuarios[uid];
    if (!u.activa || !DB.partidas[u.activa]) u.activa = nuevaPartidaObj(uid, null).id;
    writeLive(DB.partidas[u.activa].data); saveDB(); location.reload();
  }
  function crearUsuario(nombre, pin) {
    const uid = nextId('u');
    DB.usuarios[uid] = { id: uid, name: nombre, pin: pin ? hash(pin) : null, activa: null, created: Date.now() };
    entrar(uid);
  }

  /* ── UI: Mi cuenta ── */
  function pintaMenu() {
    const el = $('menuCuentaName'); if (el && user()) el.textContent = user().name;
  }
  function renderCuenta() {
    const u = user(); const body = $('cuentaBody'); if (!u || !body) return;
    const lista = partidasDe(u.id).map((p) => `
      <div class="cta-partida ${p.id === u.activa ? 'activa' : ''}">
        <div class="cta-p-info"><b>${p.name}</b><small>${p.id === u.activa ? '▶ en curso · ' : ''}${resumen(p.id === u.activa ? snapshot() : p.data)}</small></div>
        <div class="cta-p-btns">
          ${p.id === u.activa ? '' : `<button class="cta-btn" data-abrir="${p.id}">📂 Abrir</button>`}
          <button class="cta-btn peligro" data-borrar="${p.id}">🗑️</button>
        </div>
      </div>`).join('');
    body.innerHTML = `
      <div class="cta-user"><span class="cta-avatar">${u.name[0].toUpperCase()}</span>
        <div class="cta-u-txt"><b>${u.name}</b><small>${u.pin ? '🔒 protegido con PIN' : 'sin PIN'}</small></div>
        <button id="ctaCambiar" class="cta-btn">🔁 Cambiar</button></div>
      <h3 class="cta-h">🎮 Mis partidas</h3>
      <div class="cta-partidas">${lista}</div>
      <button id="ctaNueva" class="secondary-btn cta-full">➕ Nueva partida</button>
      <h3 class="cta-h">Juego</h3>
      <div class="cta-row">
        <button id="ctaAjustes" class="cta-btn cta-mitad">⚙️ Ajustes</button>
        <button id="ctaAyuda" class="cta-btn cta-mitad">❓ Cómo se juega</button>
      </div>`;
    body.querySelectorAll('[data-abrir]').forEach((b) => b.addEventListener('click', () => abrirPartida(b.dataset.abrir)));
    body.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', () => eliminarPartida(b.dataset.borrar)));
    $('ctaNueva').addEventListener('click', nuevaPartida);
    $('ctaCambiar').addEventListener('click', () => { $('cuentaModal').hidden = true; renderLogin(); $('loginModal').hidden = false; });
    $('ctaAjustes').addEventListener('click', () => { if (typeof renderSettings === 'function') { renderSettings(); $('settingsModal').hidden = false; } });
    $('ctaAyuda').addEventListener('click', () => { $('introModal').hidden = false; });
  }

  /* ── UI: ¿Quién juega? ── */
  function renderLogin() {
    const body = $('loginBody'); if (!body) return;
    const usuarios = Object.values(DB.usuarios).sort((a, b) => a.created - b.created);
    body.innerHTML = `
      <div class="login-users">${usuarios.map((x) => `
        <button class="login-user ${x.id === DB.sesion ? 'sel' : ''}" data-uid="${x.id}">
          <span class="cta-avatar">${x.name[0].toUpperCase()}</span><b>${x.name}</b>${x.pin ? '<span class="login-lock">🔒</span>' : ''}
        </button>`).join('')}</div>
      <div id="loginPin" class="login-pin" hidden>
        <input id="loginPinInput" type="password" inputmode="numeric" maxlength="4" placeholder="PIN (4 dígitos)">
        <button id="loginPinOk" class="primary-btn">Entrar</button>
      </div>
      <h3 class="cta-h">➕ Nuevo usuario</h3>
      <div class="login-nuevo">
        <input id="loginNombre" type="text" maxlength="16" placeholder="Nombre">
        <input id="loginNuevoPin" type="password" inputmode="numeric" maxlength="4" placeholder="PIN (opcional)">
        <button id="loginCrear" class="primary-btn">Crear</button>
      </div>`;
    let pendiente = null;
    body.querySelectorAll('.login-user').forEach((b) => b.addEventListener('click', () => {
      const x = DB.usuarios[b.dataset.uid];
      if (!x.pin) { entrar(x.id); return; }
      pendiente = x.id;
      $('loginPin').hidden = false; $('loginPinInput').value = ''; $('loginPinInput').focus();
    }));
    $('loginPinOk').addEventListener('click', () => {
      const x = DB.usuarios[pendiente]; if (!x) return;
      if (hash($('loginPinInput').value) === x.pin) entrar(x.id);
      else { $('loginPinInput').value = ''; $('loginPinInput').placeholder = '❌ PIN incorrecto'; }
    });
    $('loginCrear').addEventListener('click', () => {
      const nombre = $('loginNombre').value.trim(); if (!nombre) { $('loginNombre').focus(); return; }
      const pin = $('loginNuevoPin').value.trim();
      if (pin && !/^\d{4}$/.test(pin)) { $('loginNuevoPin').value = ''; $('loginNuevoPin').placeholder = '4 dígitos'; return; }
      crearUsuario(nombre, pin || null);
    });
  }

  /* ── guardado periódico de la partida activa ── */
  setInterval(guardaActiva, 30000);
  window.addEventListener('pagehide', guardaActiva);
  window.addEventListener('beforeunload', guardaActiva);

  document.addEventListener('DOMContentLoaded', () => {
    pintaMenu();
    const btn = $('menuCuenta');
    if (btn) btn.addEventListener('click', () => { renderCuenta(); $('cuentaModal').hidden = false; });
    // Cierre delegado de modales: funciona aunque la Conquista aún no haya arrancado.
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.card-close');
      if (b && b.dataset.close) { const m = $(b.dataset.close); if (m) m.hidden = true; }
    });
  });

  window.CUENTA = { user, guardaActiva };
})();
