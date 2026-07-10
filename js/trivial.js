/* =========================================================================
   Juego 4: "Trivial" de la Constitución — al estilo Trivial Pursuit.
   - Tablero circular con casillas de colores por TÍTULO.
   - Quesitos = 11 (uno por título). Ganas el quesito de un título al acertar
     una pregunta de ese título si aún no lo tienes.
   - Dado, turnos y jugadores virtuales (IA) que avanzan solos sin mostrar sus
     preguntas; su acierto se resuelve por su nivel. Gana quien reúne los 11.
   Comparte utilidades globales (TITULOS, ARTICLES, artsOfTitulo, sfx, toast,
   confetti, S, save, touchActivity).
   ========================================================================= */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, at = {}) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const sfxSafe = (k) => { try { if (typeof sfx !== 'undefined' && sfx[k]) sfx[k](); } catch { /* */ } };
  const toastSafe = (m, c) => { try { if (typeof toast === 'function') toast(m, c); } catch { /* */ } };
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  const KEY = 'ce78_trivial_v1';
  const store = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
  const saveStore = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* */ } };

  const CX = 185, CY = 185, R = 152, SR = 14, N = 33; // 33 casillas (3 por título)
  const tits = () => TITULOS; // 11 títulos
  const titAt = (i) => tits()[i % tits().length];
  const spacePos = (i) => { const a = -Math.PI / 2 + (i / N) * 2 * Math.PI; return [CX + R * Math.cos(a), CY + R * Math.sin(a)]; };
  const PLAYER_COLORS = ['#f2e2b0', '#ff6b6b', '#5db0ff', '#b48cff'];
  const PLAYER_NAMES = ['Tú', 'Ana', 'Luis', 'Marta'];
  const AI_SKILL = [0, 0.55, 0.68, 0.8];

  let T = null;

  function newGame() {
    T = {
      players: PLAYER_NAMES.map((name, i) => ({ name, color: PLAYER_COLORS[i], pos: 0, wedges: new Set(), ai: i > 0, skill: AI_SKILL[i] })),
      turn: 0, busy: false, over: false,
    };
  }

  /* ── tablero ── */
  function buildBoard() {
    const wrap = $('trivBoard'); wrap.innerHTML = '';
    const svg = el('svg', { viewBox: '0 0 370 370', class: 'triv-svg' });
    // aro exterior
    svg.appendChild(el('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: 'rgba(255,255,255,.06)', 'stroke-width': 26 }));
    // casillas
    for (let i = 0; i < N; i++) {
      const [x, y] = spacePos(i); const t = titAt(i);
      const g = el('g', { class: 'triv-space' });
      g.appendChild(el('circle', { cx: x, cy: y, r: SR, fill: t.color, stroke: '#0a1a28', 'stroke-width': 2 }));
      const tx = el('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'triv-space-em' }); tx.textContent = (MAP.titulos[t.id].emblem || '');
      g.appendChild(tx);
      svg.appendChild(g);
    }
    // centro: quesitera del jugador humano (11 porciones)
    const center = el('g', { id: 'trivPie' });
    svg.appendChild(center);
    // fichas
    const tokens = el('g', { id: 'trivTokens' });
    svg.appendChild(tokens);
    wrap.appendChild(svg);
    updateBoard();
  }
  function updateBoard() {
    // quesitera humana
    const pie = $('trivPie'); pie.innerHTML = '';
    pie.appendChild(el('circle', { cx: CX, cy: CY, r: 50, fill: '#0e1c2b', stroke: 'rgba(255,255,255,.12)', 'stroke-width': 2 }));
    const human = T.players[0];
    tits().forEach((t, k) => {
      const a0 = -Math.PI / 2 + (k / 11) * 2 * Math.PI, a1 = -Math.PI / 2 + ((k + 1) / 11) * 2 * Math.PI, r = 48;
      const x0 = CX + r * Math.cos(a0), y0 = CY + r * Math.sin(a0), x1 = CX + r * Math.cos(a1), y1 = CY + r * Math.sin(a1);
      const p = el('path', { d: `M ${CX} ${CY} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`, fill: human.wedges.has(t.id) ? t.color : '#26364a', stroke: '#0e1c2b', 'stroke-width': 1 });
      pie.appendChild(p);
    });
    const lbl = el('text', { x: CX, y: CY + 4, 'text-anchor': 'middle', class: 'triv-pie-lbl' }); lbl.textContent = `${human.wedges.size}/11`;
    pie.appendChild(lbl);
    // fichas
    const tk = $('trivTokens'); tk.innerHTML = '';
    T.players.forEach((p, pi) => {
      const [sx, sy] = spacePos(p.pos); const a = (pi / T.players.length) * 2 * Math.PI;
      const x = sx + 8 * Math.cos(a), y = sy + 8 * Math.sin(a);
      const g = el('g', {});
      g.appendChild(el('circle', { cx: x, cy: y, r: 8, fill: p.color, stroke: pi === T.turn ? '#fff' : '#0a1a28', 'stroke-width': pi === T.turn ? 2.5 : 1.5 }));
      const t = el('text', { x, y: y + 3.5, 'text-anchor': 'middle', class: 'triv-token-t' }); t.textContent = p.name[0];
      g.appendChild(t); tk.appendChild(g);
    });
  }

  /* ── panel de jugadores ── */
  function renderPlayers() {
    $('trivPlayers').innerHTML = T.players.map((p, i) => `
      <div class="triv-pl ${i === T.turn ? 'active' : ''}">
        <span class="triv-pl-dot" style="background:${p.color}">${p.name[0]}</span>
        <span class="triv-pl-name">${p.name}${p.ai ? '' : ' (tú)'}</span>
        <span class="triv-pl-wedges">${tits().map((t) => `<span class="tw" style="background:${p.wedges.has(t.id) ? t.color : '#2a3850'}"></span>`).join('')}</span>
        <span class="triv-pl-count">${p.wedges.size}/11</span>
      </div>`).join('');
  }
  function setTurnLabel() {
    const p = T.players[T.turn];
    $('trivTurn').textContent = T.over ? '' : (p.ai ? `🤖 Turno de ${p.name}…` : '🎲 Tu turno');
    const roll = $('trivRoll'); roll.hidden = T.over || p.ai; roll.disabled = T.busy;
  }

  /* ── dado y turnos ── */
  function rollValue() { return 1 + Math.floor(Math.random() * 6); }
  function showDie(v) { $('trivDice').textContent = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][v]; }

  function humanRoll() {
    if (T.busy || T.over || T.players[T.turn].ai) return;
    T.busy = true; setTurnLabel(); sfxSafe('click');
    const v = rollValue(); showDie(v);
    const p = T.players[T.turn]; p.pos = (p.pos + v) % N; updateBoard();
    setTimeout(() => askHuman(titAt(p.pos)), 450);
  }
  function askHuman(t) {
    const arts = artsOfTitulo(t.id); const n = arts[Math.floor(Math.random() * arts.length)]; const a = ARTICLES[n];
    const order = shuffle(a.o.map((_, k) => k));
    const q = $('trivQuiz'); q.hidden = false;
    q.innerHTML = `
      <div class="triv-quiz-card" style="--tc:${t.color}">
        <div class="tq-cat">${MAP.titulos[t.id].emblem || ''} ${t.roman ? 'Título ' + t.roman + ' · ' : ''}${t.name}</div>
        <div class="tc-q">${a.q}</div>
        <div class="tc-options" id="tqOpts"></div>
        <div class="tc-feedback" id="tqFb" hidden></div>
      </div>`;
    const box = $('tqOpts');
    order.forEach((oi) => { const b = document.createElement('button'); b.className = 'tc-opt'; b.textContent = a.o[oi]; b.dataset.oi = oi; b.addEventListener('click', () => humanAnswer(oi, n, a, t, box)); box.appendChild(b); });
  }
  function humanAnswer(oi, n, a, t, box) {
    const correct = oi === a.c;
    [...box.children].forEach((ch) => { ch.disabled = true; if (+ch.dataset.oi === a.c) ch.classList.add('ok'); else if (+ch.dataset.oi === oi) ch.classList.add('bad'); });
    let earned = false;
    if (correct) {
      sfxSafe('correct'); if (typeof markMastered === 'undefined') { try { S.stats.mastered[n] = true; } catch { /* */ } }
      try { S.stats.mastered = S.stats.mastered || {}; S.stats.mastered[n] = true; } catch { /* */ }
      if (typeof touchActivity === 'function') touchActivity();
      if (!T.players[0].wedges.has(t.id)) { T.players[0].wedges.add(t.id); earned = true; }
    } else sfxSafe('wrong');
    const fb = $('tqFb'); fb.hidden = false; fb.className = 'tc-feedback ' + (correct ? 'ok' : 'bad');
    fb.innerHTML = `<div class="fb-verdict">${correct ? (earned ? '✅ ¡Quesito conseguido!' : '✅ ¡Correcto!') : '❌ Incorrecto'} <span class="fb-ref">Art. ${n} · ${a.t}</span></div>
      <div class="fb-why">${a.e}</div><button id="tqNext" class="primary-btn">Continuar ➜</button>`;
    updateBoard(); renderPlayers(); if (typeof save === 'function') save();
    $('tqNext').addEventListener('click', () => { $('trivQuiz').hidden = true; if (checkWin()) return; endTurn(); });
    $('tqNext').focus();
  }

  function aiTurn() {
    const p = T.players[T.turn]; T.busy = true; setTurnLabel();
    setTimeout(() => {
      const v = rollValue(); showDie(v); p.pos = (p.pos + v) % N; updateBoard();
      setTimeout(() => {
        const t = titAt(p.pos); const hit = Math.random() < p.skill;
        if (hit && !p.wedges.has(t.id)) { p.wedges.add(t.id); toastSafe(`🤖 ${p.name} gana el quesito de ${t.roman ? 'Título ' + t.roman : t.name}`, 'ach-toast'); }
        updateBoard(); renderPlayers();
        if (checkWin()) return;
        endTurn();
      }, 650);
    }, 500);
  }
  function endTurn() {
    T.busy = false; T.turn = (T.turn + 1) % T.players.length; renderPlayers(); updateBoard(); setTurnLabel();
    if (!T.over && T.players[T.turn].ai) aiTurn();
  }
  function checkWin() {
    const w = T.players.find((p) => p.wedges.size >= 11);
    if (!w) return false;
    T.over = true; T.busy = false;
    const human = w === T.players[0];
    store.bestWedges = Math.max(store.bestWedges || 0, T.players[0].wedges.size);
    if (human) store.wins = (store.wins || 0) + 1;
    saveStore(); if (typeof save === 'function') save();
    const q = $('trivQuiz'); q.hidden = false;
    q.innerHTML = `<div class="triv-quiz-card triv-end">
      <div class="ts-emoji">${human ? '🏆' : '🤖'}</div>
      <h2>${human ? '¡Has ganado la partida!' : `Ganó ${w.name}`}</h2>
      <p class="ts-score">Tus quesitos: <b>${T.players[0].wedges.size}/11</b></p>
      <div class="ts-actions"><button id="tqAgain" class="primary-btn">Otra partida 🎲</button><button id="tqMenu" class="secondary-btn">Volver al menú</button></div>
    </div>`;
    if (human) { try { if (typeof confetti === 'function') confetti(); } catch { /* */ } }
    $('tqAgain').addEventListener('click', () => { $('trivQuiz').hidden = true; startTrivial(); });
    $('tqMenu').addEventListener('click', backToMenu);
    setTurnLabel();
    return true;
  }

  function backToMenu() { $('trivial').hidden = true; $('gameMenu').hidden = false; sfxSafe('click'); }
  function startTrivial() {
    $('gameMenu').hidden = true; $('trivQuiz').hidden = true;
    newGame(); buildBoard(); renderPlayers(); showDie(0); setTurnLabel();
    $('trivial').hidden = false;
  }
  window.startTrivial = startTrivial;

  document.addEventListener('DOMContentLoaded', () => {}); // no-op
  const roll = $('trivRoll'); if (roll) roll.addEventListener('click', humanRoll);
  const back = $('trivBack'); if (back) back.addEventListener('click', backToMenu);
})();
