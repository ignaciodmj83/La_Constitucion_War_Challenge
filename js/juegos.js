/* =========================================================================
   Lanzador de juegos + Juego 2 "Memorión".
   - Menú inicial con 4 modos (Conquista/Risk, Memorión, y 2 próximamente).
   - Memorión: galería con los 169 números de artículo; al pulsar uno, eliges
     de una lista (títulos de ≤3 palabras) de qué trata. Al acertar, la carta
     queda descubierta. Progreso propio guardado en localStorage.
   Comparte utilidades globales de game.js (S, sfx, toast, confetti…).
   ========================================================================= */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);

  // Boot global (contador de estudio + desbloqueo de audio), sea cual sea el juego.
  if (typeof bootGlobal === 'function') bootGlobal();

  const menu = $('gameMenu');
  const showMenu = () => { menu.hidden = false; };
  const hideMenu = () => { menu.hidden = true; };

  /* ── Juego 1: Conquista (Risk) ── */
  function startRisk() {
    hideMenu(); $('memoria').hidden = true;
    if (typeof startRiskGame === 'function') startRiskGame();
  }

  /* ── Juego 2: Memorión ── */
  const MEM_KEY = 'ce78_memoria_v2';
  const MDIFF = {
    facil: { name: 'Fácil', emoji: '🌱', allow: 3, desc: '5 opciones · hasta 3 fallos' },
    medio: { name: 'Medio', emoji: '⚔️', allow: 2, desc: 'todas las del título · hasta 2 fallos' },
    dificil: { name: 'Difícil', emoji: '🔥', allow: 0, desc: 'todos los artículos · sin fallar' },
  };
  let mem = loadMem();
  function loadMem() {
    try { const o = JSON.parse(localStorage.getItem(MEM_KEY)); if (o && o.runs) { o.hi = o.hi || {}; return o; } } catch { /* */ }
    let old = null; try { old = JSON.parse(localStorage.getItem('ce78_memoria_v1')); } catch { /* */ }
    return { diff: 'facil', hi: {}, runs: { facil: { matched: (old && old.matched) || {}, fails: 0 }, medio: { matched: {}, fails: 0 }, dificil: { matched: {}, fails: 0 } } };
  }
  function saveMem() { try { localStorage.setItem(MEM_KEY, JSON.stringify(mem)); } catch { /* */ } }
  function run() { return mem.runs[mem.diff]; }

  const STOP = new Set(['y', 'e', 'o', 'u', 'de', 'del', 'la', 'las', 'los', 'el', 'en', 'con', 'a', 'al', 'por', 'para', 'su', 'sus', 'un', 'una']);
  function shortTitle(n) {
    if (typeof ETIQUETAS !== 'undefined' && ETIQUETAS[n]) return ETIQUETAS[n]; // etiqueta de 3 palabras
    const t = (typeof ARTICLES !== 'undefined' && ARTICLES[n] && ARTICLES[n].t) || '';
    const w = t.replace(/[,.;:]/g, '').split(/\s+/).filter(Boolean).slice(0, 3);
    while (w.length > 1 && STOP.has(w[w.length - 1].toLowerCase())) w.pop();
    return w.join(' ');
  }
  function colorOf(n) { const tid = MAP.art.titulo[n]; return MAP.titulos[tid].color; }
  function tituloOfN(n) { const t = MAP.titulos[MAP.art.titulo[n]]; return (t.roman ? 'Título ' + t.roman + ' · ' : '') + t.name; }
  function emojiOf(n) { return (ARTICLES[n].img && ARTICLES[n].img[0]) || '📜'; }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const sfxSafe = (k) => { try { if (typeof sfx !== 'undefined' && sfx[k]) sfx[k](); } catch { /* */ } };
  function tituloArts(tid) { const r = []; for (let n = 1; n <= 169; n++) if (MAP.art.titulo[n] === tid) r.push(n); return r; }

  function renderDiffBar() {
    const bar = $('memDiffBar');
    bar.innerHTML = Object.entries(MDIFF).map(([k, d]) =>
      `<button class="mem-diff ${mem.diff === k ? 'sel' : ''}" data-md="${k}"><b>${d.emoji} ${d.name}</b><small>${d.desc}</small></button>`).join('');
    bar.querySelectorAll('.mem-diff').forEach((b) => b.addEventListener('click', () => {
      mem.diff = b.dataset.md; saveMem(); sfxSafe('click'); renderDiffBar(); buildMemGrid();
    }));
  }
  function updateLives() {
    const allow = MDIFF[mem.diff].allow, left = Math.max(0, allow - run().fails);
    $('memLives').innerHTML = allow === 0
      ? '<span class="no-fail">🔥 sin fallos</span>'
      : '❤️'.repeat(left) + '<span class="lost-heart">🤍</span>'.repeat(allow - left);
  }
  function buildMemGrid() {
    const grid = $('memGrid'); const matched = run().matched;
    grid.innerHTML = '';
    // agrupado por capítulo: cada capítulo (o título sin capítulos) va en su recuadro
    TITULOS.forEach((t) => {
      const multi = t.islands.length > 1;
      t.islands.forEach((is) => {
        const arts = (MAP.islands[is.id] && MAP.islands[is.id].arts) || [];
        if (!arts.length) return;
        const box = document.createElement('div'); box.className = 'mem-chapter'; box.style.setProperty('--tc', t.color);
        const label = multi ? is.name : ((t.roman ? 'Título ' + t.roman + ' · ' : '') + t.name);
        const head = document.createElement('div'); head.className = 'mem-ch-head';
        const gav = (typeof PERSONAJES !== 'undefined') ? PERSONAJES.avatar(t.id, 26) : `<span class="mem-ch-emblem">${MAP.titulos[t.id].emblem || ''}</span>`;
        head.innerHTML = `${gav}<span>${label}</span>`;
        const cards = document.createElement('div'); cards.className = 'mem-ch-cards';
        arts.forEach((n) => {
          const done = !!matched[n];
          const card = document.createElement('button');
          card.className = 'mem-card' + (done ? ' done' : '');
          card.style.setProperty('--tc', colorOf(n));
          card.innerHTML = done
            ? `<span class="mc-emoji">${emojiOf(n)}</span><span class="mc-n">${n}</span><span class="mc-txt">${ARTICLES[n].t}</span>`
            : `<span class="mc-n big">${n}</span>`;
          card.addEventListener('click', () => openQuiz(n));
          cards.appendChild(card);
        });
        box.appendChild(head); box.appendChild(cards); grid.appendChild(box);
      });
    });
    $('memProg').textContent = `${Object.keys(matched).length}/169`;
    updateLives();
  }

  function optionPool(n) {
    // devuelve pares {label, art} sin etiquetas repetidas; el artículo n va incluido
    const map = new Map();
    const add = (m) => { const lab = shortTitle(m); if (!map.has(lab)) map.set(lab, m); };
    if (mem.diff === 'facil') {
      add(n); let g = 0;
      while (map.size < 5 && g++ < 900) add(1 + Math.floor(Math.random() * 169));
    } else if (mem.diff === 'medio') {
      tituloArts(MAP.art.titulo[n]).forEach(add); add(n);
    } else {
      const matched = run().matched;
      for (let m = 1; m <= 169; m++) if (!matched[m]) add(m);
      add(n);
    }
    map.set(shortTitle(n), n); // asegura que la etiqueta correcta apunta a n
    return shuffle([...map.entries()].map(([label, art]) => ({ label, art })));
  }
  function openQuiz(n) {
    $('mqNum').textContent = n;
    $('mqNum').style.setProperty('--tc', colorOf(n));
    $('mqTitulo').textContent = tituloOfN(n);
    const box = $('mqOptions'); box.innerHTML = '';
    optionPool(n).forEach(({ label, art }) => {
      const row = document.createElement('div'); row.className = 'mq-row';
      const opt = document.createElement('button'); opt.className = 'mq-opt'; opt.textContent = label; opt.dataset.art = art;
      const info = document.createElement('button'); info.className = 'mq-info'; info.type = 'button'; info.textContent = 'ⓘ'; info.title = 'Ver el artículo';
      const detail = document.createElement('div'); detail.className = 'mq-detail'; detail.hidden = true;
      detail.innerHTML = `<b>Art. ${art} · ${ARTICLES[art].t}</b><br>${ARTICLES[art].e}`;
      opt.addEventListener('click', () => onPick(art, n, box));
      info.addEventListener('click', (e) => { e.stopPropagation(); detail.hidden = !detail.hidden; info.classList.toggle('open', !detail.hidden); });
      const top = document.createElement('div'); top.className = 'mq-row-top';
      top.appendChild(opt); top.appendChild(info);
      row.appendChild(top); row.appendChild(detail); box.appendChild(row);
    });
    $('memQuiz').hidden = false; box.scrollTop = 0;
  }
  function onPick(art, n, box) {
    const btn = [...box.querySelectorAll('.mq-opt')].find((o) => +o.dataset.art === art && !o.disabled);
    if (!btn) return;
    if (art === n) {
      box.querySelectorAll('.mq-opt').forEach((o) => { o.disabled = true; });
      btn.classList.add('ok'); run().matched[n] = true;
      const c = Object.keys(run().matched).length; mem.hi[mem.diff] = Math.max(mem.hi[mem.diff] || 0, c);
      saveMem(); sfxSafe('correct');
      if (typeof touchActivity === 'function') touchActivity(); if (typeof save === 'function') save();
      setTimeout(() => { $('memQuiz').hidden = true; buildMemGrid(); if (Object.keys(run().matched).length === 169) memVictory(); }, 480);
    } else {
      // fallo: solo se descarta esa opción (puedes reintentar); cuesta una vida
      btn.classList.add('bad'); btn.disabled = true; run().fails++; saveMem(); sfxSafe('wrong'); updateLives();
      if (run().fails > MDIFF[mem.diff].allow) { box.querySelectorAll('.mq-opt').forEach((o) => { o.disabled = true; }); setTimeout(memGameOver, 600); }
    }
  }
  function memGameOver() {
    const got = Object.keys(run().matched).length;
    $('memQuiz').hidden = true;
    run().matched = {}; run().fails = 0; saveMem(); buildMemGrid();
    try { if (typeof toast === 'function') toast(`💥 Partida perdida (${MDIFF[mem.diff].name}). Habías descubierto ${got}. ¡Vuelve a empezar!`, 'danger'); } catch { /* */ }
    try { if (typeof sfx !== 'undefined' && sfx.defeat) sfx.defeat(); } catch { /* */ }
  }
  function memVictory() {
    try { if (typeof confetti === 'function') confetti(); } catch { /* */ }
    try { if (typeof toast === 'function') toast(`🎉 ¡Los 169 artículos en ${MDIFF[mem.diff].name}!`, 'ach-toast'); } catch { /* */ }
  }
  function startMemoria() { hideMenu(); mem = loadMem(); renderDiffBar(); buildMemGrid(); $('memoria').hidden = false; }

  /* ── Sistema de estudio: índice completo de la Constitución (títulos → capítulos → artículos) ── */
  function buildEstudio() {
    const tree = $('estudioTree'); if (!tree) return;
    tree.innerHTML = TITULOS.map((t) => {
      const arts = artsOfTitulo(t.id);
      const emblem = MAP.titulos[t.id].emblem || t.emblem || (t.faction && t.faction.unit) || '📜';
      const multi = t.islands.length > 1;
      const body = t.islands.map((is) => {
        const rows = ((MAP.islands[is.id] && MAP.islands[is.id].arts) || []).map((n) => {
          const a = ARTICLES[n];
          return `<div class="ix-art-row" data-n="${n}">
            <button class="ix-art" type="button">
              <span class="ix-emoji" style="--tc:${colorOf(n)}">${emojiOf(n)}</span>
              <span class="ix-n">Art. ${n}</span>
              <span class="ix-t">${a.t}</span>
              <span class="ix-caret">▸</span>
            </button>
            <div class="ix-detail" hidden>
              <p class="ix-detail-txt">${a.e}</p>
              <button class="ix-speak" type="button" data-n="${n}">🗣️ Escuchar</button>
            </div>
          </div>`;
        }).join('');
        return (multi ? `<div class="ix-cap">${is.name}</div>` : '') + rows;
      }).join('');
      const guard = (typeof PERSONAJES !== 'undefined') ? PERSONAJES.of(t.id) : null;
      const icon = guard ? PERSONAJES.frame(t.id, 'ix-guard-frame') : `<span class="ix-emblem" style="background:${t.color}">${emblem}</span>`;
      return `<div class="ix-titulo" data-tid="${t.id}">
        <button class="ix-sum" type="button">
          <span class="ix-arrow">▸</span>
          ${icon}
          <span class="ix-tname">${t.roman ? t.roman + '. ' : ''}${t.name}${guard ? `<small class="ix-guard">${guard.name}</small>` : ''}</span>
          <span class="ix-prog">${arts.length} art.</span></button>
        <div class="ix-body">${body}</div></div>`;
    }).join('');
    tree.querySelectorAll('.ix-sum').forEach((b) => b.addEventListener('click', () => {
      b.parentElement.classList.toggle('open'); sfxSafe('click');
    }));
    tree.querySelectorAll('.ix-art').forEach((b) => b.addEventListener('click', () => {
      const row = b.parentElement; const open = !row.classList.contains('open');
      row.classList.toggle('open', open);
      const d = row.querySelector('.ix-detail'); if (d) d.hidden = !open;
      sfxSafe('click');
    }));
    tree.querySelectorAll('.ix-speak').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); if (typeof speakArticle === 'function') speakArticle(+b.dataset.n); sfxSafe('click');
    }));
    $('estudioProg').textContent = '11 títulos · 169 art.';
  }
  function startEstudio() { hideMenu(); buildEstudio(); $('estudio').hidden = false; }

  /* ── cableado ── */
  function hideAllScreens() { ['memoria', 'tribunal', 'trivial', 'estudio'].forEach((id) => { const el = $(id); if (el) el.hidden = true; }); }
  menu.querySelectorAll('.game-card[data-game]').forEach((b) => b.addEventListener('click', () => {
    const g = b.dataset.game; sfxSafe('click'); hideAllScreens();
    if (g === 'risk') startRisk();
    else if (g === 'memoria') startMemoria();
    else if (g === 'tribunal' && typeof startTribunal === 'function') startTribunal();
    else if (g === 'trivial' && typeof startTrivial === 'function') startTrivial();
  }));
  // botón "Menú de juegos" desde la partida de Conquista
  const btnMenu = $('btnMenu');
  if (btnMenu) btnMenu.addEventListener('click', () => { hideAllScreens(); showMenu(); sfxSafe('click'); });
  $('memBack').addEventListener('click', () => { $('memoria').hidden = true; showMenu(); sfxSafe('click'); });
  const btnEstudio = $('menuEstudio');
  if (btnEstudio) btnEstudio.addEventListener('click', () => { sfxSafe('click'); hideAllScreens(); startEstudio(); });
  const estBack = $('estudioBack');
  if (estBack) estBack.addEventListener('click', () => { $('estudio').hidden = true; if (typeof stopVoice === 'function') stopVoice(); showMenu(); sfxSafe('click'); });
  const mqClose = $('memQuiz').querySelector('.card-close');
  if (mqClose) mqClose.addEventListener('click', () => { $('memQuiz').hidden = true; });

  showMenu();
})();
