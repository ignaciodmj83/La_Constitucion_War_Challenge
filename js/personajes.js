/* =========================================================================
   PERSONAJES — el "Consejo Constituyente": 11 guardianes, uno por título
   (+ La Unidad de España como figura final/heroína).
   Capa visual compartida por los 4 juegos:
     - retrato enmarcado por título (con su color y emblema),
     - overlay "el personaje habla" al escuchar la explicación de un artículo,
     - fichas/avatares para el Trivial y profesores para el estudio.
   El arte real vive en assets/personajes/<id>.(png|webp); si falta, se dibuja
   un retrato-marco temático como respaldo, así que todo funciona sin las
   imágenes y se engalana automáticamente al añadirlas.
   Sin dependencias. Usa TITULOS/MAP/ARTICLES/VOZ globales.
   ========================================================================= */
'use strict';
(function () {
  const ASSET = (id) => `assets/personajes/${id}.png`;

  // Metadatos por título (id de hierarchy.js). El "name/tagline" acompaña al arte.
  // "voz" es el timbre con el que habla el personaje: 'mujer' | 'joven' | 'viejo'.
  const PERSONAJES = {
    preliminar: { name: 'El Sabio Fundador', tagline: 'Guardián de las Tablas: Democracia, Derechos y Libertad.', emblem: '📜', voz: 'viejo' },
    t1: { name: 'El Custodio de los Derechos', tagline: 'Con la paloma y la balanza, protejo los derechos fundamentales.', emblem: '🕊️', voz: 'joven' },
    t2: { name: 'El Rey', tagline: 'Corona y cetro: símbolo de la unidad y permanencia del Estado.', emblem: '👑', voz: 'viejo' },
    t3: { name: 'La Voz de las Cortes', tagline: 'Custodio el Libro de las Leyes que aprueban Congreso y Senado.', emblem: '🏛️', voz: 'mujer' },
    t4: { name: 'El Ministro del Reino', tagline: 'Pluma y decreto: aquí se gobierna y se administra.', emblem: '⚙️', voz: 'joven' },
    t5: { name: 'El Enlace Parlamentario', tagline: 'Control parlamentario y cooperación entre Gobierno y Cortes.', emblem: '🤝', voz: 'joven' },
    t6: { name: 'El Juez del Búho', tagline: 'Balanza y sabiduría: la justicia emana del pueblo.', emblem: '⚖️', voz: 'viejo' },
    t7: { name: 'El Tesorero del Reino', tagline: 'Presupuestos y tributos: yo custodio el oro del Estado.', emblem: '🪙', voz: 'joven' },
    t8: { name: 'La Cartógrafa de España', tagline: 'Municipios, provincias y autonomías: yo dibujé este mapa.', emblem: '🗺️', voz: 'mujer' },
    t9: { name: 'Los Guardianes del Tribunal', tagline: 'Con lupa y llama vigilamos que ninguna ley traicione la Constitución.', emblem: '🛡️', voz: 'viejo' },
    t10: { name: 'La Arquitecta de la Reforma', tagline: 'Plano en mano, diseño cómo se cambia la Constitución.', emblem: '📐', voz: 'mujer' },
  };
  // Figura final / heroína transversal (victorias, portada, centro del Trivial).
  const UNIDAD = { id: 'unidad', name: 'La Unidad de España', tagline: 'Corona, escudo y espada: la Nación indisoluble que a todos une.', emblem: '🛡️', voz: 'mujer', img: ASSET('unidad') };

  function pjOf(tid) {
    const p = PERSONAJES[tid]; if (!p) return null;
    const t = (typeof TITULOS !== 'undefined') && TITULOS.find((x) => x.id === tid);
    return Object.assign({ id: tid, color: (t && t.color) || '#8a93a8', roman: (t && t.roman) || '', titulo: (t && t.name) || '', img: ASSET(tid) }, p);
  }
  const list = () => Object.keys(PERSONAJES).map(pjOf);

  /* ── Retrato enmarcado (arte real con respaldo temático) ──
     size: 'sm' | 'md' | 'lg'. Devuelve HTML. */
  function portrait(tid, size = 'md') {
    const p = tid === 'unidad' ? Object.assign({ color: '#c9a13b', roman: '', titulo: 'La Unidad de España' }, UNIDAD) : pjOf(tid);
    if (!p) return '';
    return `<figure class="pj-portrait pj-${size}" style="--tc:${p.color}">
      <div class="pj-frame">
        <img class="pj-art" src="${p.img}" alt="${p.name}" loading="lazy"
             onerror="this.classList.add('pj-art-missing')">
        <span class="pj-fallback" aria-hidden="true">${p.emblem}</span>
      </div>
      <figcaption class="pj-cap"><b class="pj-name">${p.name}</b>${p.roman ? `<span class="pj-role">Título ${p.roman}</span>` : ''}</figcaption>
    </figure>`;
  }

  /* ── Marco solo (retrato sin pie de foto; para cabeceras como la Preparación) ── */
  function frame(tid, cls = '') {
    const p = tid === 'unidad' ? Object.assign({ color: '#c9a13b' }, UNIDAD) : pjOf(tid);
    if (!p) return '';
    return `<div class="pj-frame ${cls}" style="--tc:${p.color}">
      <img class="pj-art" src="${p.img}" alt="${p.name}" onerror="this.classList.add('pj-art-missing')">
      <span class="pj-fallback" aria-hidden="true">${p.emblem}</span></div>`;
  }

  /* ── Avatar compacto (círculo temático con arte o emblema) ── */
  function avatar(tid, px = 34) {
    const p = tid === 'unidad' ? Object.assign({ color: '#c9a13b' }, UNIDAD) : pjOf(tid);
    if (!p) return '';
    return `<span class="pj-avatar" style="--tc:${p.color};width:${px}px;height:${px}px" title="${p.name}">
      <img src="${p.img}" alt="${p.name}" onerror="this.classList.add('pj-art-missing')">
      <span class="pj-av-fb" aria-hidden="true">${p.emblem}</span></span>`;
  }

  /* ── Overlay "el personaje habla" ── */
  let host = null, hideTimer = null;
  function ensureHost() {
    if (host) return host;
    host = document.createElement('div');
    host.className = 'pj-speak'; host.hidden = true;
    host.addEventListener('click', (e) => { if (e.target === host || e.target.classList.contains('pj-speak-close')) hideSpeaking(); });
    document.body.appendChild(host);
    return host;
  }
  /* ¿El retrato tiene fondo transparente? Solo entonces puede mostrarse
     recortado a lo grande, como asistente al pie de la pantalla (efecto
     visual-novel). Se comprueba el borde superior de la imagen una vez y
     se recuerda el resultado por personaje. */
  const RECORTABLE = {};
  function esRecortable(img) {
    try {
      const c = document.createElement('canvas'); c.width = 12; c.height = 12;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, 12, 12);
      const d = x.getImageData(0, 0, 12, 2).data;
      let alfa = 0; for (let i = 3; i < d.length; i += 4) alfa += d[i];
      return alfa < 24 * 255 * 0.4; // franja superior mayormente transparente
    } catch { return false; }
  }
  /* Consulta asíncrona reutilizable: ¿este guardián tiene retrato recortado? */
  function recortable(tid, cb) {
    if (RECORTABLE[tid] !== undefined) { cb(RECORTABLE[tid]); return; }
    const im = new Image();
    im.onload = () => { RECORTABLE[tid] = esRecortable(im); cb(RECORTABLE[tid]); };
    im.onerror = () => { RECORTABLE[tid] = false; cb(false); };
    im.src = ASSET(tid);
  }
  function showSpeaking(tid, text) {
    const p = pjOf(tid); if (!p) return;
    const h = ensureHost();
    h.style.setProperty('--tc', p.color);
    h.classList.toggle('has-actor', RECORTABLE[tid] === true);
    h.innerHTML = `
      <img class="pj-actor" src="${p.img}" alt="" aria-hidden="true">
      <div class="pj-speak-card">
        <button class="pj-speak-close" title="Cerrar">✕</button>
        <div class="pj-speaker">
          <div class="pj-frame pj-talking">
            <img class="pj-art" src="${p.img}" alt="${p.name}" onerror="this.classList.add('pj-art-missing')">
            <span class="pj-fallback" aria-hidden="true">${p.emblem}</span>
          </div>
          <div class="pj-speaker-meta"><b>${p.name}</b><small>${p.roman ? 'Título ' + p.roman + ' · ' : ''}${p.titulo}</small></div>
        </div>
        <div class="pj-bubble"><span class="pj-bubble-dots"><i></i><i></i><i></i></span><p class="pj-bubble-txt">${text}</p></div>
      </div>`;
    const actor = h.querySelector('.pj-actor');
    if (RECORTABLE[tid] === undefined) {
      const decide = () => { RECORTABLE[tid] = esRecortable(actor); h.classList.toggle('has-actor', RECORTABLE[tid]); };
      if (actor.complete && actor.naturalWidth) decide();
      else { actor.addEventListener('load', decide); actor.addEventListener('error', () => { RECORTABLE[tid] = false; }); }
    }
    h.hidden = false;
    requestAnimationFrame(() => h.classList.add('show'));
    clearTimeout(hideTimer);
  }
  function hideSpeaking() {
    if (!host) return;
    host.classList.remove('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (host) host.hidden = true; }, 260);
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch { /* */ }
  }

  // Ganchos que dispara speakArticle() en game.js.
  window.pjOnSpeak = function (n, text) {
    try { const tid = MAP.art.titulo[n]; showSpeaking(tid, text); } catch { /* */ }
  };
  window.pjOnSpeakEnd = function () { hideSpeaking(); };

  // API pública para los juegos.
  window.PERSONAJES = { of: pjOf, list, portrait, frame, avatar, recortable, unidad: () => UNIDAD, showSpeaking, hideSpeaking };
})();
