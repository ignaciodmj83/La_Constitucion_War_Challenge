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
  const GAME_KEYS = ['ce78_warchallenge_v3', 'ce78_memoria_v2', 'ce78_tribunal_v1', 'ce78_trivial_v1', 'ce78_islas_v1'];

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
  const NUBE_UID = 'nube';
  const esNube = () => DB.sesion === NUBE_UID && typeof NUBE !== 'undefined' && NUBE.sesion();
  function paqueteNube() {
    const u = DB.usuarios[NUBE_UID];
    return { partidas: partidasDe(NUBE_UID), activa: u ? u.activa : null, live: snapshot() };
  }
  function guardaActiva() {
    const u = user(); if (!u || !u.activa || !DB.partidas[u.activa]) return;
    try { if (typeof save === 'function') save(); } catch { /* */ }
    const p = DB.partidas[u.activa];
    p.data = snapshot(); p.updated = Date.now();
    saveDB();
    if (esNube()) NUBE.push(paqueteNube());
  }
  /* Aplica en este dispositivo los datos de la cuenta en la nube y recarga. */
  function aplicarNube(nombre, datos) {
    guardaActiva();
    for (const pid of Object.keys(DB.partidas)) if (DB.partidas[pid].uid === NUBE_UID) delete DB.partidas[pid];
    DB.usuarios[NUBE_UID] = { id: NUBE_UID, name: nombre, pin: null, activa: null, created: Date.now(), nube: true };
    if (datos && Array.isArray(datos.partidas) && datos.partidas.length) {
      for (const p of datos.partidas) DB.partidas[p.id] = Object.assign({}, p, { uid: NUBE_UID });
      DB.usuarios[NUBE_UID].activa = datos.activa && DB.partidas[datos.activa] ? datos.activa : datos.partidas[0].id;
      writeLive(datos.live || DB.partidas[DB.usuarios[NUBE_UID].activa].data);
    } else {
      DB.usuarios[NUBE_UID].activa = nuevaPartidaObj(NUBE_UID, null).id;
      writeLive(null);
    }
    DB.sesion = NUBE_UID; saveDB(); location.reload();
  }
  function cerrarNube() {
    guardaActiva();
    if (typeof NUBE !== 'undefined') { NUBE.pushAhora(paqueteNube()); NUBE.logout(); }
    let uid = Object.keys(DB.usuarios).find((k) => k !== NUBE_UID);
    if (!uid) { uid = nextId('u'); DB.usuarios[uid] = { id: uid, name: 'Invitado', pin: null, activa: null, created: Date.now() }; }
    const u = DB.usuarios[uid];
    if (!u.activa || !DB.partidas[u.activa]) u.activa = nuevaPartidaObj(uid, null).id;
    DB.sesion = uid; writeLive(DB.partidas[u.activa].data); saveDB(); location.reload();
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

  /* ── contraseña ── */
  function setPass(pass) { const u = user(); u.pin = pass ? hash(pass) : null; saveDB(); pintaMenu(); }
  const checkPass = (u, pass) => hash(pass || '') === u.pin;
  const esc = (s) => String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const toastSafe = (m) => { try { if (typeof toast === 'function') toast(m); } catch { /* */ } };

  /* ── UI: Mi cuenta (centro de la cuenta) ── */
  function pintaMenu() {
    const el = $('menuCuentaName'); if (el && user()) el.textContent = user().name;
  }
  let vista = 'inicio'; // 'inicio' | 'pass'
  function openCuenta() { vista = 'inicio'; renderCuenta(); $('cuentaModal').hidden = false; }

  function renderCuenta() {
    const u = user(); const body = $('cuentaBody'); if (!u || !body) return;
    if (vista === 'pass') return renderPass();
    const lista = partidasDe(u.id).map((p) => `
      <div class="cta-partida ${p.id === u.activa ? 'activa' : ''}">
        <div class="cta-p-info"><b>${esc(p.name)}</b><small>${p.id === u.activa ? '▶ en curso · ' : ''}${resumen(p.id === u.activa ? snapshot() : p.data)}</small></div>
        <div class="cta-p-btns">
          ${p.id === u.activa ? '' : `<button class="cta-btn" data-abrir="${p.id}">📂 Abrir</button>`}
          <button class="cta-btn peligro" data-borrar="${p.id}" title="Eliminar partida">🗑️</button>
        </div>
      </div>`).join('');
    const nube = esNube();
    const cab = nube
      ? `<div class="cta-user">
          <span class="cta-avatar">☁️</span>
          <div class="cta-u-txt"><b id="ctaName">${esc(u.name)}</b><small>cuenta en la nube · disponible en cualquier dispositivo</small></div>
        </div>
        <div class="cta-row"><button id="ctaPrefs" class="cta-btn cta-mitad">⚙️ Preferencias</button>
          <span class="cta-sync" id="ctaSync">☁️ sincronizada</span></div>`
      : `<div class="cta-user">
        <span class="cta-avatar">${esc(u.name[0].toUpperCase())}</span>
        <div class="cta-u-txt"><b id="ctaName">${esc(u.name)}</b><small>${u.pin ? '🔒 con contraseña' : 'perfil local de este dispositivo'}</small></div>
        <button id="ctaEditName" class="cta-btn" title="Editar nombre">✏️</button>
      </div>
      <div class="cta-row">
        <button id="ctaPass" class="cta-btn cta-mitad">🔑 ${u.pin ? 'Cambiar' : 'Poner'} contraseña</button>
        <button id="ctaPrefs" class="cta-btn cta-mitad">⚙️ Preferencias</button>
      </div>`;
    body.innerHTML = cab + `
      <h3 class="cta-h">🎮 Mis partidas</h3>
      <div class="cta-partidas">${lista}</div>
      <button id="ctaNueva" class="secondary-btn cta-full">➕ Nueva partida</button>
      <div class="cta-foot">
        <button id="ctaSalir" class="cta-btn cta-salir">🚪 Salir / cambiar de usuario</button>
        <button id="ctaAyuda" class="cta-link">❓ Cómo se juega</button>
      </div>`;
    body.querySelectorAll('[data-abrir]').forEach((b) => b.addEventListener('click', () => abrirPartida(b.dataset.abrir)));
    body.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', () => eliminarPartida(b.dataset.borrar)));
    $('ctaNueva').addEventListener('click', nuevaPartida);
    if ($('ctaEditName')) $('ctaEditName').addEventListener('click', editarNombre);
    if ($('ctaPass')) $('ctaPass').addEventListener('click', () => { vista = 'pass'; renderPass(); });
    $('ctaPrefs').addEventListener('click', () => { if (typeof renderSettings === 'function') { renderSettings(); $('settingsModal').hidden = false; } });
    if (nube) { const b = $('ctaSalir'); if (b) b.textContent = '🚪 Cerrar sesión de la nube'; }
    $('ctaSalir').addEventListener('click', () => {
      if (esNube()) { if (confirm('¿Cerrar la sesión de la nube en este dispositivo? Tu progreso queda guardado en el servidor.')) cerrarNube(); return; }
      $('cuentaModal').hidden = true; renderLogin(); $('loginModal').hidden = false;
    });
    $('ctaAyuda').addEventListener('click', () => { $('introModal').hidden = false; });
  }

  function editarNombre() {
    const u = user(); const el = $('ctaName'); if (!el) return;
    el.innerHTML = `<input id="ctaNameInput" class="cta-inline-input" maxlength="16" value="${esc(u.name)}">`;
    const inp = $('ctaNameInput'); inp.focus(); inp.select();
    let done = false;
    const save = () => { if (done) return; done = true; const v = inp.value.trim(); if (v) { u.name = v; saveDB(); pintaMenu(); } renderCuenta(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') { done = true; renderCuenta(); } });
    inp.addEventListener('blur', save);
  }

  function renderPass() {
    const u = user(); const body = $('cuentaBody'); if (!body) return;
    body.innerHTML = `
      <button class="cta-volver" id="ctaPassBack">⬅️ Mi cuenta</button>
      <h3 class="cta-h">🔑 ${u.pin ? 'Cambiar' : 'Poner'} contraseña</h3>
      <div class="cta-form">
        ${u.pin ? `<label>Contraseña actual<input id="passAct" type="password" autocomplete="current-password"></label>` : ''}
        <label>${u.pin ? 'Nueva contraseña' : 'Contraseña'}<input id="passNew" type="password" autocomplete="new-password" placeholder="mínimo 3 caracteres"></label>
        <label>Repetir contraseña<input id="passRep" type="password" autocomplete="new-password"></label>
        <div id="passErr" class="cta-err" hidden></div>
        <div class="cta-row">
          ${u.pin ? `<button id="passQuitar" class="cta-btn cta-mitad peligro">Quitar contraseña</button>` : ''}
          <button id="passGuardar" class="primary-btn cta-mitad">Guardar</button>
        </div>
      </div>`;
    const err = (m) => { const e = $('passErr'); e.textContent = m; e.hidden = false; };
    const volver = () => { vista = 'inicio'; renderCuenta(); };
    $('ctaPassBack').addEventListener('click', volver);
    $('passGuardar').addEventListener('click', () => {
      if (u.pin && !checkPass(u, $('passAct').value)) return err('La contraseña actual no es correcta.');
      const nw = $('passNew').value, rp = $('passRep').value;
      if (nw.length < 3) return err('La contraseña debe tener al menos 3 caracteres.');
      if (nw !== rp) return err('Las dos contraseñas no coinciden.');
      setPass(nw); volver(); toastSafe('🔑 Contraseña actualizada');
    });
    if ($('passQuitar')) $('passQuitar').addEventListener('click', () => {
      if (!checkPass(u, $('passAct').value)) return err('Escribe tu contraseña actual para quitarla.');
      setPass(null); volver(); toastSafe('🔓 Contraseña quitada');
    });
  }

  /* ── UI: Salir / ¿Quién juega? (selector limpio, solo al cambiar de usuario) ── */
  function renderLogin() {
    const body = $('loginBody'); if (!body) return;
    const usuarios = Object.values(DB.usuarios).filter((x) => x.id !== NUBE_UID).sort((a, b) => a.created - b.created);
    body.innerHTML = `
      <div id="loginNube" hidden>
        <h3 class="cta-h">☁️ Cuenta en la nube</h3>
        <p class="login-sub">Con tu cuenta juegas desde cualquier dispositivo y tu progreso se guarda en el servidor.</p>
        <div class="cta-form">
          <label>Usuario<input id="nubeNombre" type="text" maxlength="20" autocomplete="username" placeholder="Tu nombre de usuario"></label>
          <label>Contraseña<input id="nubePass" type="password" autocomplete="current-password" placeholder="mínimo 4 caracteres"></label>
          <div id="nubeErr" class="cta-err" hidden></div>
          <div class="cta-row">
            <button id="nubeEntrar" class="primary-btn cta-mitad">Entrar</button>
            <button id="nubeCrear" class="cta-btn cta-mitad">Crear cuenta</button>
          </div>
        </div>
        <h3 class="cta-h">📱 O sigue en este dispositivo</h3>
      </div>
      <p class="login-sub">Elige tu usuario para continuar tu progreso, o crea uno nuevo.</p>
      <div class="login-users">${usuarios.map((x) => `
        <button class="login-user ${x.id === DB.sesion ? 'sel' : ''}" data-uid="${x.id}">
          <span class="cta-avatar">${esc(x.name[0].toUpperCase())}</span>
          <span class="login-u-name">${esc(x.name)}${x.id === DB.sesion ? ' <small>(actual)</small>' : ''}</span>
          <span class="login-u-end">${x.pin ? '🔒' : '▸'}</span>
        </button>`).join('')}</div>
      <div id="loginPinWrap" class="login-pinwrap" hidden>
        <label id="loginPinFor" class="login-pin-for"></label>
        <div class="login-pin-row">
          <input id="loginPinInput" type="password" autocomplete="current-password" placeholder="Contraseña">
          <button id="loginPinOk" class="primary-btn">Entrar</button>
        </div>
        <div id="loginPinErr" class="cta-err" hidden></div>
      </div>
      <button id="loginNuevoBtn" class="cta-link cta-full">➕ Crear usuario nuevo</button>
      <div id="loginNuevo" class="cta-form" hidden>
        <label>Nombre<input id="loginNombre" type="text" maxlength="16" placeholder="Tu nombre"></label>
        <label>Contraseña (opcional)<input id="loginNuevoPin" type="password" placeholder="déjalo vacío si no quieres"></label>
        <button id="loginCrear" class="primary-btn cta-full">Crear y entrar</button>
      </div>`;
    let pendiente = null;
    body.querySelectorAll('.login-user').forEach((b) => b.addEventListener('click', () => {
      const x = DB.usuarios[b.dataset.uid];
      if (!x.pin) { entrar(x.id); return; }
      pendiente = x.id;
      $('loginPinFor').textContent = `🔒 Contraseña de ${x.name}`;
      $('loginPinWrap').hidden = false; $('loginPinErr').hidden = true;
      const inp = $('loginPinInput'); inp.value = ''; inp.focus();
    }));
    const tryLogin = () => {
      const x = DB.usuarios[pendiente]; if (!x) return;
      if (hash($('loginPinInput').value) === x.pin) entrar(x.id);
      else { $('loginPinInput').value = ''; const e = $('loginPinErr'); e.textContent = '❌ Contraseña incorrecta'; e.hidden = false; $('loginPinInput').focus(); }
    };
    $('loginPinOk').addEventListener('click', tryLogin);
    $('loginPinInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
    $('loginNuevoBtn').addEventListener('click', () => { const n = $('loginNuevo'); n.hidden = !n.hidden; if (!n.hidden) $('loginNombre').focus(); });
    $('loginCrear').addEventListener('click', () => {
      const nombre = $('loginNombre').value.trim(); if (!nombre) { $('loginNombre').focus(); return; }
      crearUsuario(nombre, $('loginNuevoPin').value.trim() || null);
    });
    // cuenta en la nube (solo si el backend está desplegado y con BBDD)
    if (typeof NUBE !== 'undefined') NUBE.disponible().then((ok) => {
      if (!ok) return;
      $('loginNube').hidden = false;
      const err = (m) => { const e = $('nubeErr'); e.textContent = m; e.hidden = false; };
      const accion = async (crear) => {
        const nombre = $('nubeNombre').value.trim(), pass = $('nubePass').value;
        if (!nombre) { $('nubeNombre').focus(); return; }
        if (pass.length < 4) return err('La contraseña debe tener al menos 4 caracteres.');
        try {
          const datos = crear ? await NUBE.registro(nombre, pass) : await NUBE.login(nombre, pass);
          aplicarNube(NUBE.sesion().nombre, datos);
        } catch (e2) { err(e2.message); }
      };
      $('nubeEntrar').addEventListener('click', () => accion(false));
      $('nubeCrear').addEventListener('click', () => accion(true));
      $('nubePass').addEventListener('keydown', (e2) => { if (e2.key === 'Enter') accion(false); });
    });
  }

  /* ── guardado periódico de la partida activa ── */
  setInterval(guardaActiva, 30000);
  const alSalir = () => { guardaActiva(); if (esNube()) NUBE.pushAhora(paqueteNube()); };
  window.addEventListener('pagehide', alSalir);
  window.addEventListener('beforeunload', alSalir);

  document.addEventListener('DOMContentLoaded', () => {
    pintaMenu();
    const btn = $('menuCuenta');
    if (btn) btn.addEventListener('click', openCuenta);
    // Cierre delegado de modales: funciona aunque la Conquista aún no haya arrancado.
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.card-close');
      if (b && b.dataset.close) { const m = $(b.dataset.close); if (m) m.hidden = true; }
    });
  });

  window.CUENTA = { user, guardaActiva };
})();
