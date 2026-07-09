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
    try { const o = JSON.parse(localStorage.getItem(MEM_KEY)); if (o && o.runs) return o; } catch { /* */ }
    let old = null; try { old = JSON.parse(localStorage.getItem('ce78_memoria_v1')); } catch { /* */ }
    return { diff: 'facil', runs: { facil: { matched: (old && old.matched) || {}, fails: 0 }, medio: { matched: {}, fails: 0 }, dificil: { matched: {}, fails: 0 } } };
  }
  function saveMem() { try { localStorage.setItem(MEM_KEY, JSON.stringify(mem)); } catch { /* */ } }
  function run() { return mem.runs[mem.diff]; }

  const STOP = new Set(['y', 'e', 'o', 'u', 'de', 'del', 'la', 'las', 'los', 'el', 'en', 'con', 'a', 'al', 'por', 'para', 'su', 'sus', 'un', 'una']);
  function shortTitle(n) {
    const t = (typeof ARTICLES !== 'undefined' && ARTICLES[n] && ARTICLES[n].t) || '';
    const w = t.replace(/[,.;:]/g, '').split(/\s+/).filter(Boolean).slice(0, 3);
    while (w.length > 1 && STOP.has(w[w.length - 1].toLowerCase())) w.pop();
    return w.join(' ');
  }
  function colorOf(n) { const tid = MAP.art.titulo[n]; return MAP.titulos[tid].color; }
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
    for (let n = 1; n <= 169; n++) {
      const done = !!matched[n];
      const card = document.createElement('button');
      card.className = 'mem-card' + (done ? ' done' : '');
      card.style.setProperty('--tc', colorOf(n));
      card.innerHTML = done
        ? `<span class="mc-emoji">${emojiOf(n)}</span><span class="mc-n">${n}</span>`
        : `<span class="mc-n big">${n}</span>`;
      card.addEventListener('click', () => openQuiz(n));
      grid.appendChild(card);
    }
    $('memProg').textContent = `${Object.keys(matched).length}/169`;
    updateLives();
  }

  function optionPool(n) {
    const correct = shortTitle(n);
    if (mem.diff === 'facil') {
      const set = new Set([correct]); let g = 0;
      while (set.size < 5 && g++ < 800) { const m = 1 + Math.floor(Math.random() * 169); const s = shortTitle(m); if (s && s !== correct) set.add(s); }
      return shuffle([...set]);
    }
    if (mem.diff === 'medio') {
      const set = new Set(tituloArts(MAP.art.titulo[n]).map(shortTitle)); set.add(correct);
      return shuffle([...set]);
    }
    // difícil: todos los artículos menos los ya adivinados
    const matched = run().matched; const set = new Set();
    for (let m = 1; m <= 169; m++) { if (!matched[m]) set.add(shortTitle(m)); }
    set.add(correct);
    return shuffle([...set]);
  }
  function openQuiz(n) {
    $('mqNum').textContent = n;
    $('mqNum').style.setProperty('--tc', colorOf(n));
    const correct = shortTitle(n);
    const box = $('mqOptions'); box.innerHTML = '';
    optionPool(n).forEach((s) => {
      const b = document.createElement('button'); b.className = 'mq-opt'; b.textContent = s;
      b.addEventListener('click', () => {
        if (b.disabled) return;
        if (s === correct) {
          b.classList.add('ok'); run().matched[n] = true; saveMem(); sfxSafe('correct');
          [...box.children].forEach((c) => { c.disabled = true; });
          setTimeout(() => {
            $('memQuiz').hidden = true; buildMemGrid();
            if (Object.keys(run().matched).length === 169) memVictory();
          }, 460);
        } else {
          b.classList.add('bad'); b.disabled = true; run().fails++; saveMem(); sfxSafe('wrong'); updateLives();
          if (run().fails > MDIFF[mem.diff].allow) { [...box.children].forEach((c) => { c.disabled = true; }); setTimeout(memGameOver, 550); }
        }
      });
      box.appendChild(b);
    });
    $('memQuiz').hidden = false;
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

  /* ── cableado ── */
  menu.querySelectorAll('.game-card[data-game]').forEach((b) => b.addEventListener('click', () => {
    const g = b.dataset.game; sfxSafe('click');
    if (g === 'risk') startRisk();
    else if (g === 'memoria') startMemoria();
    else if (g === 'tribunal' && typeof startTribunal === 'function') { $('memoria').hidden = true; startTribunal(); }
  }));
  $('memBack').addEventListener('click', () => { $('memoria').hidden = true; showMenu(); sfxSafe('click'); });
  const mqClose = $('memQuiz').querySelector('.card-close');
  if (mqClose) mqClose.addEventListener('click', () => { $('memQuiz').hidden = true; });

  showMenu();
})();
