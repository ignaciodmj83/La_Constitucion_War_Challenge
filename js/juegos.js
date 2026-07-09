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
  const MEM_KEY = 'ce78_memoria_v1';
  let mem = loadMem();
  function loadMem() { try { return JSON.parse(localStorage.getItem(MEM_KEY)) || { matched: {} }; } catch { return { matched: {} }; } }
  function saveMem() { try { localStorage.setItem(MEM_KEY, JSON.stringify(mem)); } catch { /* */ } }

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

  function buildMemGrid() {
    const grid = $('memGrid'); const matched = mem.matched || {};
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
    updateMemProg();
  }
  function updateMemProg() { $('memProg').textContent = `${Object.keys(mem.matched || {}).length}/169`; }

  function openQuiz(n) {
    $('mqNum').textContent = n;
    $('mqNum').style.setProperty('--tc', colorOf(n));
    const correct = shortTitle(n);
    const opts = new Set([correct]);
    let guard = 0;
    while (opts.size < 6 && guard++ < 800) { const m = 1 + Math.floor(Math.random() * 169); const s = shortTitle(m); if (s && s !== correct) opts.add(s); }
    const box = $('mqOptions'); box.innerHTML = '';
    shuffle([...opts]).forEach((s) => {
      const b = document.createElement('button'); b.className = 'mq-opt'; b.textContent = s;
      b.addEventListener('click', () => {
        if (b.disabled) return;
        if (s === correct) {
          b.classList.add('ok'); mem.matched[n] = true; saveMem(); sfxSafe('correct');
          [...box.children].forEach((c) => { c.disabled = true; });
          setTimeout(() => {
            $('memQuiz').hidden = true; buildMemGrid();
            if (Object.keys(mem.matched).length === 169) memVictory();
          }, 480);
        } else { b.classList.add('bad'); b.disabled = true; sfxSafe('wrong'); }
      });
      box.appendChild(b);
    });
    $('memQuiz').hidden = false;
  }
  function memVictory() {
    try { if (typeof confetti === 'function') confetti(); } catch { /* */ }
    try { if (typeof toast === 'function') toast('🎉 ¡Has emparejado los 169 artículos!', 'ach-toast'); } catch { /* */ }
  }
  function startMemoria() { hideMenu(); mem = loadMem(); buildMemGrid(); $('memoria').hidden = false; }

  /* ── cableado ── */
  menu.querySelectorAll('.game-card[data-game]').forEach((b) => b.addEventListener('click', () => {
    const g = b.dataset.game; sfxSafe('click');
    if (g === 'risk') startRisk(); else if (g === 'memoria') startMemoria();
  }));
  $('memBack').addEventListener('click', () => { $('memoria').hidden = true; showMenu(); sfxSafe('click'); });
  const mqClose = $('memQuiz').querySelector('.card-close');
  if (mqClose) mqClose.addEventListener('click', () => { $('memQuiz').hidden = true; });

  showMenu();
})();
