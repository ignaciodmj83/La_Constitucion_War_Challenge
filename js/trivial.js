/* =========================================================================
   Juego 4: "Trivial" de la Constitución — rueda con radios (Trivial Pursuit).
   - Rueda exterior de casillas; en cada unión radio↔rueda hay una CASILLA
     ESPECIAL grande (⭐) donde se captura el quesito de ese título (11).
   - Las casillas intermedias (rueda y radios) tienen títulos aleatorios
     intercalados. En los radios también hay casillas.
   - Al reunir los 11 quesitos se va al centro y se responde la batería final
     (una pregunta por título). Cada pregunta muestra el artículo y su símbolo.
   - Dado con dirección, turnos y 3 jugadores virtuales.
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

  const SEG = 11, SPP = 3, RING = SEG * SPP, SPOKE_LEN = 2;
  const C = 200, RR = 164, VB = 400;
  const HQ = (k) => k * SPP;
  const isHQ = (i) => i % SPP === 0;
  const hqTit = (i) => Math.floor(i / SPP);
  const tit = (k) => TITULOS[k];
  const ringPos = (i) => { const a = -Math.PI / 2 + (i / RING) * 2 * Math.PI; return [C + RR * Math.cos(a), C + RR * Math.sin(a)]; };
  const spokeRad = (d) => RR - d * (RR - 72) / (SPOKE_LEN + 1);
  const spokePos = (k, d) => { const a = -Math.PI / 2 + (HQ(k) / RING) * 2 * Math.PI; const r = spokeRad(d); return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
  const PLAYER_COLORS = ['#f2e2b0', '#ff6b6b', '#5db0ff', '#b48cff'];
  const PLAYER_NAMES = ['Tú', 'El Rey', 'La Cartógrafa', 'El Juez'];
  const PLAYER_TID = ['preliminar', 't2', 't8', 't6']; // guardián que encarna cada jugador
  const AI_SKILL = [0, 0.55, 0.68, 0.8];
  const pjAvatar = (tid, px) => (typeof PERSONAJES !== 'undefined') ? PERSONAJES.avatar(tid, px) : '';

  let T = null, SPTIT = [], SPKTIT = [];
  function genSpaces() {
    SPTIT = []; for (let i = 0; i < RING; i++) SPTIT[i] = isHQ(i) ? hqTit(i) : Math.floor(Math.random() * SEG);
    SPKTIT = []; for (let k = 0; k < SEG; k++) { SPKTIT[k] = []; for (let d = 1; d <= SPOKE_LEN; d++) SPKTIT[k][d] = Math.floor(Math.random() * SEG); }
  }
  function newGame() {
    genSpaces();
    T = { players: PLAYER_NAMES.map((name, i) => ({ name, tid: PLAYER_TID[i], color: PLAYER_COLORS[i], loc: 'ring', i: 0, k: 0, depth: 0, wedges: new Set(), ai: i > 0, skill: AI_SKILL[i], homing: false })), turn: 0, busy: false, over: false, dieShown: 0 };
  }
  const nodePos = (p) => p.loc === 'center' ? [C, C] : p.loc === 'spoke' ? spokePos(p.k, p.depth) : ringPos(p.i);
  const titOfNode = (p) => p.loc === 'ring' ? SPTIT[p.i] : p.loc === 'spoke' ? SPKTIT[p.k][p.depth] : -1;
  const needed = (p) => TITULOS.filter((t) => !p.wedges.has(t.id));

  function pathToCenter(p) {
    if (p.loc === 'center') return [];
    if (p.loc === 'spoke') { const path = []; for (let d = p.depth + 1; d <= SPOKE_LEN; d++) path.push({ loc: 'spoke', k: p.k, depth: d }); path.push({ loc: 'center' }); return path; }
    let best = null;
    for (let k = 0; k < SEG; k++) { const hq = HQ(k); const cw = (hq - p.i + RING) % RING, ccw = (p.i - hq + RING) % RING; const dist = Math.min(cw, ccw); const dir = cw <= ccw ? 1 : -1; if (!best || dist < best.dist) best = { k, dist, dir }; }
    const path = []; let cur = p.i;
    for (let s = 0; s < best.dist; s++) { cur = (cur + best.dir + RING) % RING; path.push({ loc: 'ring', i: cur }); }
    for (let d = 1; d <= SPOKE_LEN; d++) path.push({ loc: 'spoke', k: best.k, depth: d });
    path.push({ loc: 'center' });
    return path;
  }
  function applyStep(p, s) { p.loc = s.loc; if (s.i != null) p.i = s.i; if (s.k != null) p.k = s.k; if (s.depth != null) p.depth = s.depth; }

  /* ── tablero ── */
  function space(svg, x, y, r, t, hq) {
    const g = el('g', {});
    if (hq) g.appendChild(el('circle', { cx: x, cy: y, r: r + 4, fill: 'none', stroke: '#f2e2b0', 'stroke-width': 2.5, 'stroke-dasharray': '4 3' }));
    g.appendChild(el('circle', { cx: x, cy: y, r, fill: t.color, stroke: '#0a1a28', 'stroke-width': 2 }));
    const tx = el('text', { x, y: y + r * 0.32, 'text-anchor': 'middle', class: 'triv-space-em', style: `font-size:${(r * 0.95).toFixed(0)}px` }); tx.textContent = MAP.titulos[t.id].emblem || '';
    g.appendChild(tx); svg.appendChild(g);
  }
  function buildBoard() {
    const wrap = $('trivBoard'); wrap.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${VB} ${VB}`, class: 'triv-svg' });
    for (let k = 0; k < SEG; k++) { const [hx, hy] = ringPos(HQ(k)); svg.appendChild(el('line', { x1: C, y1: C, x2: hx, y2: hy, class: 'triv-spoke' })); }
    for (let i = 0; i < RING; i++) { const [x, y] = ringPos(i); space(svg, x, y, isHQ(i) ? 19 : 12, tit(SPTIT[i]), isHQ(i)); }
    for (let k = 0; k < SEG; k++) for (let d = 1; d <= SPOKE_LEN; d++) { const [x, y] = spokePos(k, d); space(svg, x, y, 11, tit(SPKTIT[k][d]), false); }
    svg.appendChild(el('g', { id: 'trivPie' }));
    svg.appendChild(el('g', { id: 'trivTokens' }));
    wrap.appendChild(svg); updateBoard();
  }
  function updateBoard() {
    const pie = $('trivPie'); pie.innerHTML = '';
    pie.appendChild(el('circle', { cx: C, cy: C, r: 44, fill: '#0e1c2b', stroke: T.players[0].homing ? '#f2e2b0' : 'rgba(255,255,255,.14)', 'stroke-width': T.players[0].homing ? 3 : 2 }));
    const human = T.players[0];
    TITULOS.forEach((t, k) => {
      const a0 = -Math.PI / 2 + (k / SEG) * 2 * Math.PI, a1 = -Math.PI / 2 + ((k + 1) / SEG) * 2 * Math.PI, r = 42;
      const x0 = C + r * Math.cos(a0), y0 = C + r * Math.sin(a0), x1 = C + r * Math.cos(a1), y1 = C + r * Math.sin(a1);
      pie.appendChild(el('path', { d: `M ${C} ${C} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`, fill: human.wedges.has(t.id) ? t.color : '#26364a', stroke: '#0e1c2b', 'stroke-width': 1 }));
    });
    const lbl = el('text', { x: C, y: C + 5, 'text-anchor': 'middle', class: 'triv-pie-lbl' }); lbl.textContent = human.homing ? '🎯' : `${human.wedges.size}/11`;
    pie.appendChild(lbl);
    const tk = $('trivTokens'); tk.innerHTML = '';
    T.players.forEach((p, pi) => {
      const [sx, sy] = nodePos(p); const a = (pi / T.players.length) * 2 * Math.PI; const off = p.loc === 'center' ? 28 : 9;
      const x = sx + off * Math.cos(a), y = sy + off * Math.sin(a);
      const g = el('g', {});
      g.appendChild(el('circle', { cx: x, cy: y, r: 8, fill: p.color, stroke: pi === T.turn ? '#fff' : '#0a1a28', 'stroke-width': pi === T.turn ? 2.5 : 1.5 }));
      const t = el('text', { x, y: y + 3.5, 'text-anchor': 'middle', class: 'triv-token-t' }); t.textContent = p.name[0];
      g.appendChild(t); tk.appendChild(g);
    });
  }
  function renderPlayers() {
    $('trivPlayers').innerHTML = T.players.map((p, i) => `
      <div class="triv-pl ${i === T.turn ? 'active' : ''}">
        <span class="triv-pl-av" style="--tc:${p.color}">${pjAvatar(p.tid, 30) || `<span class="triv-pl-dot" style="background:${p.color}">${p.name[0]}</span>`}</span>
        <span class="triv-pl-name">${p.name}${p.ai ? '' : ' (tú)'}${p.homing ? ' 🎯' : ''}</span>
        <span class="triv-pl-count">${p.wedges.size}/11</span>
        <span class="triv-pl-wedges">${TITULOS.map((t) => `<span class="tw" style="background:${p.wedges.has(t.id) ? t.color : '#2a3850'}"></span>`).join('')}</span>
      </div>`).join('');
  }

  /* ── controles / turnos ── */
  const rollValue = () => 1 + Math.floor(Math.random() * 6);
  const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  function renderControls() {
    const p = T.players[T.turn]; const box = $('trivButtons');
    $('trivDice').textContent = T.dieShown ? DIE[T.dieShown] : '🎲';
    if (T.over || (p && p.ai)) { box.innerHTML = ''; return; }
    if (p.homing && p.loc === 'center') box.innerHTML = `<button class="primary-btn" id="tbFinal">🎯 Prueba final</button>`;
    else if (p.homing) box.innerHTML = `<button class="primary-btn" id="tbCenter">🎯 Avanzar al centro</button>`;
    else box.innerHTML = `<button class="secondary-btn" id="tbL">🎲 ◀</button><button class="secondary-btn" id="tbR">▶ 🎲</button>`;
    const bind = (id, fn) => { const b = $(id); if (b) b.addEventListener('click', fn); };
    bind('tbL', () => humanMove(-1)); bind('tbR', () => humanMove(1)); bind('tbCenter', humanHome); bind('tbFinal', startBattery);
  }
  function setTurn() {
    const p = T.players[T.turn];
    $('trivTurn').textContent = T.over ? '' : (p.ai ? `🤖 Turno de ${p.name}…` : (p.homing ? '🎯 ¡Al centro!' : '🎲 Tu turno'));
    renderControls();
  }
  const artBadge = (n, t) => `<span class="tq-art"><span class="tq-sym" style="background:${t.color}">${(ARTICLES[n].img && ARTICLES[n].img[0]) || '📜'}</span>Art. ${n}</span>`;

  function humanMove(dir) {
    const p = T.players[T.turn]; if (T.busy || p.ai || p.homing) return; T.busy = true;
    const v = rollValue(); T.dieShown = v; sfxSafe('click');
    p.i = ((p.i + dir * v) % RING + RING) % RING; updateBoard(); renderControls();
    setTimeout(() => askHuman(p), 350);
  }
  function humanHome() {
    const p = T.players[T.turn]; if (T.busy || !p.homing || p.loc === 'center') return; T.busy = true;
    const v = rollValue(); T.dieShown = v; sfxSafe('click');
    const path = pathToCenter(p); if (v >= path.length) applyStep(p, { loc: 'center' }); else applyStep(p, path[v - 1]);
    updateBoard(); renderControls();
    if (p.loc === 'center') setTimeout(startBattery, 400); else setTimeout(endTurn, 500);
  }
  function askHuman(p) {
    const k = titOfNode(p); const t = tit(k); const hq = p.loc === 'ring' && isHQ(p.i);
    const arts = artsOfTitulo(t.id); const n = arts[Math.floor(Math.random() * arts.length)]; const a = ARTICLES[n];
    const order = shuffle(a.o.map((_, k2) => k2));
    const q = $('trivQuiz'); q.hidden = false;
    q.innerHTML = `<div class="triv-quiz-card" style="--tc:${t.color}">
      <div class="tq-head"><div class="tq-cat">${pjAvatar(t.id, 30)}<span>${t.roman ? 'Título ' + t.roman + ' · ' : ''}${t.name}${hq ? ' · ⭐ QUESITO' : ''}</span></div>${artBadge(n, t)}</div>
      <div class="tc-q">${a.q}</div><div class="tc-options" id="tqOpts"></div><div class="tc-feedback" id="tqFb" hidden></div></div>`;
    const box = $('tqOpts');
    order.forEach((oi) => { const b = document.createElement('button'); b.className = 'tc-opt'; b.textContent = a.o[oi]; b.dataset.oi = oi; b.addEventListener('click', () => humanAnswer(oi, n, a, k, hq, box)); box.appendChild(b); });
  }
  function humanAnswer(oi, n, a, k, hq, box) {
    const t = tit(k); const correct = oi === a.c;
    [...box.children].forEach((ch) => { ch.disabled = true; if (+ch.dataset.oi === a.c) ch.classList.add('ok'); else if (+ch.dataset.oi === oi) ch.classList.add('bad'); });
    let earned = false;
    if (correct) {
      sfxSafe('correct'); try { S.stats.mastered = S.stats.mastered || {}; S.stats.mastered[n] = true; } catch { /* */ }
      if (typeof touchActivity === 'function') touchActivity();
      if (hq && !T.players[0].wedges.has(t.id)) { T.players[0].wedges.add(t.id); earned = true; if (T.players[0].wedges.size >= SEG) { T.players[0].homing = true; toastSafe('🎯 ¡Tienes los 11 quesitos! Ve al centro.', 'ach-toast'); } }
    } else sfxSafe('wrong');
    const fb = $('tqFb'); fb.hidden = false; fb.className = 'tc-feedback ' + (correct ? 'ok' : 'bad');
    fb.innerHTML = `<div class="fb-verdict">${correct ? (earned ? '⭐ ¡Quesito capturado!' : '✅ ¡Correcto!') : '❌ Incorrecto'} <span class="fb-ref">Art. ${n} · ${a.t}</span></div>
      <div class="fb-why">${a.e}</div><button id="tqNext" class="primary-btn">Continuar ➜</button>`;
    updateBoard(); renderPlayers(); if (typeof save === 'function') save();
    $('tqNext').addEventListener('click', () => { $('trivQuiz').hidden = true; endTurn(); }); $('tqNext').focus();
  }

  /* ── batería final ── */
  function startBattery() {
    const p = T.players[T.turn]; if (p.ai) return; T.busy = true;
    const order = shuffle(TITULOS.map((_, k) => k)); let idx = 0;
    const step = () => {
      if (idx >= order.length) { finishGame(0); return; }
      const t = TITULOS[order[idx]]; const arts = artsOfTitulo(t.id); const n = arts[Math.floor(Math.random() * arts.length)]; const a = ARTICLES[n];
      const ord = shuffle(a.o.map((_, k) => k));
      const q = $('trivQuiz'); q.hidden = false;
      q.innerHTML = `<div class="triv-quiz-card triv-battery" style="--tc:${t.color}">
        <div class="tq-head"><div class="tq-cat">${pjAvatar(t.id, 30)}<span>🎯 Final ${idx + 1}/${SEG} · ${t.roman ? 'Título ' + t.roman + ' · ' : ''}${t.name}</span></div>${artBadge(n, t)}</div>
        <div class="tc-q">${a.q}</div><div class="tc-options" id="tqOpts"></div></div>`;
      const box = $('tqOpts');
      ord.forEach((oi) => { const b = document.createElement('button'); b.className = 'tc-opt'; b.textContent = a.o[oi]; b.dataset.oi = oi; b.addEventListener('click', () => {
        [...box.children].forEach((ch) => { ch.disabled = true; if (+ch.dataset.oi === a.c) ch.classList.add('ok'); else if (+ch.dataset.oi === oi) ch.classList.add('bad'); });
        if (oi === a.c) { sfxSafe('correct'); try { S.stats.mastered[n] = true; } catch { /* */ } if (typeof touchActivity === 'function') touchActivity(); idx++; setTimeout(step, 420); }
        else { sfxSafe('wrong'); setTimeout(batteryFail, 700); }
      }); box.appendChild(b); });
    };
    step();
  }
  function batteryFail() {
    $('trivQuiz').innerHTML = `<div class="triv-quiz-card triv-end"><div class="ts-emoji">😵</div><h2>Prueba final fallada</h2>
      <p class="ts-score">Casi. Reintenta la batería en tu próximo turno.</p><div class="ts-actions"><button id="tqBk" class="primary-btn">Seguir</button></div></div>`;
    $('tqBk').addEventListener('click', () => { $('trivQuiz').hidden = true; endTurn(); });
  }

  /* ── IA ── */
  function aiTurn() {
    const p = T.players[T.turn]; T.busy = true; setTurn();
    setTimeout(() => {
      const v = rollValue(); T.dieShown = v; renderControls();
      if (p.homing) {
        const path = pathToCenter(p); if (v >= path.length) applyStep(p, { loc: 'center' }); else applyStep(p, path[v - 1]);
        updateBoard();
        if (p.loc === 'center') { if (Math.random() < Math.pow(p.skill, 3)) { setTimeout(() => finishGame(T.turn), 500); return; } toastSafe(`🤖 ${p.name} falla la prueba final`, ''); }
        setTimeout(endTurn, 650); return;
      }
      const need = new Set(needed(p).map((t) => TITULOS.indexOf(t)));
      const score = (dir) => { const land = ((p.i + dir * v) % RING + RING) % RING; if (isHQ(land) && need.has(hqTit(land))) return -1; let m = 99; need.forEach((k) => { const d = Math.min((HQ(k) - land + RING) % RING, (land - HQ(k) + RING) % RING); m = Math.min(m, d); }); return m; };
      const dir = score(1) <= score(-1) ? 1 : -1;
      p.i = ((p.i + dir * v) % RING + RING) % RING; updateBoard();
      setTimeout(() => {
        if (isHQ(p.i)) { const k = hqTit(p.i); const t = TITULOS[k]; if (!p.wedges.has(t.id) && Math.random() < p.skill) { p.wedges.add(t.id); toastSafe(`🤖 ${p.name} captura el quesito de ${t.roman ? 'Título ' + t.roman : t.name}`, 'ach-toast'); if (p.wedges.size >= SEG) { p.homing = true; toastSafe(`🤖 ${p.name} va al centro`, ''); } } }
        renderPlayers(); updateBoard(); setTimeout(endTurn, 500);
      }, 500);
    }, 550);
  }
  function endTurn() {
    if (T.over) return;
    T.busy = false; T.dieShown = 0; T.turn = (T.turn + 1) % T.players.length; renderPlayers(); updateBoard(); setTurn();
    if (T.players[T.turn].ai) aiTurn();
  }
  function finishGame(winnerIdx) {
    T.over = true; T.busy = false; const human = winnerIdx === 0;
    store.bestWedges = Math.max(store.bestWedges || 0, T.players[0].wedges.size);
    if (human) store.wins = (store.wins || 0) + 1;
    saveStore(); if (typeof save === 'function') save();
    const q = $('trivQuiz'); q.hidden = false;
    const unidadArt = (typeof PERSONAJES !== 'undefined') ? PERSONAJES.portrait('unidad', 'sm') : `<div class="ts-emoji">${human ? '🏆' : '🤖'}</div>`;
    q.innerHTML = `<div class="triv-quiz-card triv-end" style="--tc:#c9a13b">
      ${human ? unidadArt : `<div class="ts-emoji">🤖</div>`}
      <h2>${human ? '🏆 ¡Alcanzaste La Unidad de España!' : `Ganó ${T.players[winnerIdx].name}`}</h2>
      <p class="ts-score">Completaste ${T.players[0].wedges.size}/11 quesitos.</p>
      <div class="ts-actions"><button id="tqAgain" class="primary-btn">Otra partida 🎲</button><button id="tqMenu" class="secondary-btn">Volver al menú</button></div></div>`;
    if (human) { try { if (typeof confetti === 'function') confetti(); } catch { /* */ } }
    $('tqAgain').addEventListener('click', () => { $('trivQuiz').hidden = true; startTrivial(); });
    $('tqMenu').addEventListener('click', backToMenu); setTurn();
  }

  function backToMenu() { $('trivial').hidden = true; $('gameMenu').hidden = false; sfxSafe('click'); }
  function startTrivial() { $('gameMenu').hidden = true; $('trivQuiz').hidden = true; newGame(); buildBoard(); renderPlayers(); setTurn(); $('trivial').hidden = false; }
  window.startTrivial = startTrivial;
  const back = $('trivBack'); if (back) back.addEventListener('click', backToMenu);
})();
