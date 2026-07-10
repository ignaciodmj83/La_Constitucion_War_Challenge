/* =========================================================================
   Juego 4: "Trivial" de la Constitución — rueda con radios (Trivial Pursuit).
   - Rueda exterior de casillas (una por título, en arcos de color).
   - En cada unión radio↔rueda hay una CASILLA ESPECIAL (HQ) donde se captura
     el quesito de ese título (11 quesitos = 11 títulos).
   - Radios que llevan al CENTRO. Al reunir los 11 quesitos, se va al centro y
     se responde una batería final (una pregunta por título); acertarlas todas
     antes que los rivales = victoria.
   - Dado, turnos y 3 jugadores virtuales que avanzan solos.
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

  const SEG = 11, SPP = 3, RING = SEG * SPP;         // 11 títulos × 3 casillas = 33
  const C = 200, RR = 168, SPR = 13, SPMID = 92, VB = 400;
  const HQ = (k) => k * SPP;
  const isHQ = (i) => i % SPP === 0;
  const titIdx = (i) => Math.floor(i / SPP);
  const tit = (k) => TITULOS[k];
  const ringPos = (i) => { const a = -Math.PI / 2 + (i / RING) * 2 * Math.PI; return [C + RR * Math.cos(a), C + RR * Math.sin(a)]; };
  const spokeMid = (k) => { const a = -Math.PI / 2 + (HQ(k) / RING) * 2 * Math.PI; return [C + SPMID * Math.cos(a), C + SPMID * Math.sin(a)]; };
  const PLAYER_COLORS = ['#f2e2b0', '#ff6b6b', '#5db0ff', '#b48cff'];
  const PLAYER_NAMES = ['Tú', 'Ana', 'Luis', 'Marta'];
  const AI_SKILL = [0, 0.55, 0.68, 0.8];

  let T = null;
  function newGame() {
    T = {
      players: PLAYER_NAMES.map((name, i) => ({ name, color: PLAYER_COLORS[i], loc: 'ring', i: 0, k: 0, wedges: new Set(), ai: i > 0, skill: AI_SKILL[i], homing: false })),
      turn: 0, busy: false, over: false, dieShown: 0,
    };
  }
  const nodePos = (p) => p.loc === 'center' ? [C, C] : p.loc === 'spoke' ? spokeMid(p.k) : ringPos(p.i);
  const needed = (p) => TITULOS.filter((t) => !p.wedges.has(t.id));

  /* ── caminos hacia el centro (para el homing) ── */
  function pathToCenter(p) {
    if (p.loc === 'center') return [];
    if (p.loc === 'spoke') return [{ loc: 'center' }];
    let best = null;
    for (let k = 0; k < SEG; k++) { const hq = HQ(k); const cw = (hq - p.i + RING) % RING, ccw = (p.i - hq + RING) % RING; const dist = Math.min(cw, ccw); const dir = cw <= ccw ? 1 : -1; if (!best || dist < best.dist) best = { k, dist, dir }; }
    const path = []; let cur = p.i;
    for (let s = 0; s < best.dist; s++) { cur = (cur + best.dir + RING) % RING; path.push({ loc: 'ring', i: cur }); }
    path.push({ loc: 'spoke', k: best.k }); path.push({ loc: 'center' });
    return path;
  }

  /* ── tablero ── */
  function buildBoard() {
    const wrap = $('trivBoard'); wrap.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${VB} ${VB}`, class: 'triv-svg' });
    // radios
    for (let k = 0; k < SEG; k++) { const [hx, hy] = ringPos(HQ(k)); svg.appendChild(el('line', { x1: C, y1: C, x2: hx, y2: hy, class: 'triv-spoke' })); }
    // casillas de la rueda
    for (let i = 0; i < RING; i++) {
      const [x, y] = ringPos(i); const t = tit(titIdx(i)); const hq = isHQ(i);
      const g = el('g', {});
      if (hq) g.appendChild(el('circle', { cx: x, cy: y, r: SPR + 5, fill: 'none', stroke: '#f2e2b0', 'stroke-width': 2.5, 'stroke-dasharray': '3 3' }));
      g.appendChild(el('circle', { cx: x, cy: y, r: hq ? SPR + 1.5 : SPR, fill: t.color, stroke: '#0a1a28', 'stroke-width': 2 }));
      const tx = el('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'triv-space-em' }); tx.textContent = MAP.titulos[t.id].emblem || '';
      g.appendChild(tx); svg.appendChild(g);
    }
    // nodos de radio (intermedios)
    for (let k = 0; k < SEG; k++) { const [x, y] = spokeMid(k); svg.appendChild(el('circle', { cx: x, cy: y, r: 6, fill: tit(k).color, opacity: 0.5, stroke: '#0a1a28', 'stroke-width': 1.5 })); }
    // centro (quesitera humana + meta)
    const center = el('g', { id: 'trivPie' }); svg.appendChild(center);
    const tokens = el('g', { id: 'trivTokens' }); svg.appendChild(tokens);
    wrap.appendChild(svg);
    updateBoard();
  }
  function updateBoard() {
    const pie = $('trivPie'); pie.innerHTML = '';
    pie.appendChild(el('circle', { cx: C, cy: C, r: 46, fill: '#0e1c2b', stroke: T.players[T.turn] === T.players[0] && T.players[0].homing ? '#f2e2b0' : 'rgba(255,255,255,.14)', 'stroke-width': T.players[0].homing ? 3 : 2 }));
    const human = T.players[0];
    TITULOS.forEach((t, k) => {
      const a0 = -Math.PI / 2 + (k / SEG) * 2 * Math.PI, a1 = -Math.PI / 2 + ((k + 1) / SEG) * 2 * Math.PI, r = 44;
      const x0 = C + r * Math.cos(a0), y0 = C + r * Math.sin(a0), x1 = C + r * Math.cos(a1), y1 = C + r * Math.sin(a1);
      pie.appendChild(el('path', { d: `M ${C} ${C} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`, fill: human.wedges.has(t.id) ? t.color : '#26364a', stroke: '#0e1c2b', 'stroke-width': 1 }));
    });
    const lbl = el('text', { x: C, y: C + 5, 'text-anchor': 'middle', class: 'triv-pie-lbl' }); lbl.textContent = human.homing ? '🎯' : `${human.wedges.size}/11`;
    pie.appendChild(lbl);
    const tk = $('trivTokens'); tk.innerHTML = '';
    T.players.forEach((p, pi) => {
      const [sx, sy] = nodePos(p); const a = (pi / T.players.length) * 2 * Math.PI; const off = p.loc === 'center' ? 30 : 9;
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
        <span class="triv-pl-dot" style="background:${p.color}">${p.name[0]}</span>
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
    bind('tbL', () => humanMove(-1)); bind('tbR', () => humanMove(1));
    bind('tbCenter', humanHome); bind('tbFinal', startBattery);
  }
  function setTurn() {
    const p = T.players[T.turn];
    $('trivTurn').textContent = T.over ? '' : (p.ai ? `🤖 Turno de ${p.name}…` : (p.homing ? '🎯 ¡Al centro!' : '🎲 Tu turno'));
    renderControls();
  }

  function humanMove(dir) {
    const p = T.players[T.turn]; if (T.busy || p.ai || p.homing) return; T.busy = true;
    const v = rollValue(); T.dieShown = v; sfxSafe('click');
    p.i = ((p.i + dir * v) % RING + RING) % RING; updateBoard(); renderControls();
    setTimeout(() => askHuman(p), 350);
  }
  function humanHome() {
    const p = T.players[T.turn]; if (T.busy || !p.homing || p.loc === 'center') return; T.busy = true;
    const v = rollValue(); T.dieShown = v; sfxSafe('click');
    const path = pathToCenter(p); const step = path[Math.min(v, path.length) - 1];
    Object.assign(p, { loc: step.loc, i: step.i != null ? step.i : p.i, k: step.k != null ? step.k : p.k });
    updateBoard(); renderControls();
    if (p.loc === 'center') setTimeout(startBattery, 400);
    else setTimeout(endTurn, 500);
  }
  function askHuman(p) {
    const t = tit(titIdx(p.i)); const hq = isHQ(p.i);
    const arts = artsOfTitulo(t.id); const n = arts[Math.floor(Math.random() * arts.length)]; const a = ARTICLES[n];
    const order = shuffle(a.o.map((_, k) => k));
    const q = $('trivQuiz'); q.hidden = false;
    q.innerHTML = `<div class="triv-quiz-card" style="--tc:${t.color}">
      <div class="tq-cat">${MAP.titulos[t.id].emblem || ''} ${t.roman ? 'Título ' + t.roman + ' · ' : ''}${t.name}${hq ? ' · ⭐ CASILLA DE QUESITO' : ''}</div>
      <div class="tc-q">${a.q}</div><div class="tc-options" id="tqOpts"></div><div class="tc-feedback" id="tqFb" hidden></div></div>`;
    const box = $('tqOpts');
    order.forEach((oi) => { const b = document.createElement('button'); b.className = 'tc-opt'; b.textContent = a.o[oi]; b.dataset.oi = oi; b.addEventListener('click', () => humanAnswer(oi, n, a, t, hq, box)); box.appendChild(b); });
  }
  function humanAnswer(oi, n, a, t, hq, box) {
    const correct = oi === a.c;
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
    $('tqNext').addEventListener('click', () => { $('trivQuiz').hidden = true; endTurn(); });
    $('tqNext').focus();
  }

  /* ── batería final (una pregunta por título) ── */
  function startBattery() {
    const p = T.players[T.turn]; if (p.ai) return;
    T.busy = true; const order = shuffle(TITULOS.map((_, k) => k));
    let idx = 0;
    const step = () => {
      if (idx >= order.length) { finishGame(0); return; }
      const t = TITULOS[order[idx]]; const arts = artsOfTitulo(t.id); const n = arts[Math.floor(Math.random() * arts.length)]; const a = ARTICLES[n];
      const ord = shuffle(a.o.map((_, k) => k));
      const q = $('trivQuiz'); q.hidden = false;
      q.innerHTML = `<div class="triv-quiz-card triv-battery" style="--tc:${t.color}">
        <div class="tq-cat">🎯 Prueba final · ${idx + 1}/${SEG} · ${t.roman ? 'Título ' + t.roman + ' · ' : ''}${t.name}</div>
        <div class="tc-q">${a.q}</div><div class="tc-options" id="tqOpts"></div></div>`;
      const box = $('tqOpts');
      ord.forEach((oi) => { const b = document.createElement('button'); b.className = 'tc-opt'; b.textContent = a.o[oi]; b.dataset.oi = oi; b.addEventListener('click', () => {
        [...box.children].forEach((ch) => { ch.disabled = true; if (+ch.dataset.oi === a.c) ch.classList.add('ok'); else if (+ch.dataset.oi === oi) ch.classList.add('bad'); });
        if (oi === a.c) { sfxSafe('correct'); try { S.stats.mastered[n] = true; } catch { /* */ } if (typeof touchActivity === 'function') touchActivity(); idx++; setTimeout(step, 420); }
        else { sfxSafe('wrong'); setTimeout(() => batteryFail(), 700); }
      }); box.appendChild(b); });
    };
    step();
  }
  function batteryFail() {
    const q = $('trivQuiz');
    q.innerHTML = `<div class="triv-quiz-card triv-end"><div class="ts-emoji">😵</div><h2>Prueba final fallada</h2>
      <p class="ts-score">Casi. Vuelve a intentar la batería en tu próximo turno.</p>
      <div class="ts-actions"><button id="tqBk" class="primary-btn">Seguir</button></div></div>`;
    $('tqBk').addEventListener('click', () => { $('trivQuiz').hidden = true; endTurn(); });
  }

  /* ── IA ── */
  function aiTurn() {
    const p = T.players[T.turn]; T.busy = true; setTurn();
    setTimeout(() => {
      const v = rollValue(); T.dieShown = v; renderControls();
      if (p.homing) {
        const path = pathToCenter(p); const step = path[Math.min(v, path.length) - 1] || { loc: 'center' };
        Object.assign(p, { loc: step.loc, i: step.i != null ? step.i : p.i, k: step.k != null ? step.k : p.k });
        updateBoard();
        if (p.loc === 'center') { const pass = Math.random() < Math.pow(p.skill, 3); if (pass) { setTimeout(() => finishGame(T.turn), 500); return; } toastSafe(`🤖 ${p.name} falla la prueba final`, ''); }
        setTimeout(endTurn, 650); return;
      }
      // elegir dirección hacia el HQ necesario más cercano
      const need = new Set(needed(p).map((t) => TITULOS.indexOf(t)));
      const score = (dir) => { const land = ((p.i + dir * v) % RING + RING) % RING; if (isHQ(land) && need.has(titIdx(land))) return -1; let m = 99; need.forEach((k) => { const d = Math.min((HQ(k) - land + RING) % RING, (land - HQ(k) + RING) % RING); m = Math.min(m, d); }); return m; };
      const dir = score(1) <= score(-1) ? 1 : -1;
      p.i = ((p.i + dir * v) % RING + RING) % RING; updateBoard();
      setTimeout(() => {
        if (isHQ(p.i)) { const k = titIdx(p.i); const t = TITULOS[k]; if (!p.wedges.has(t.id) && Math.random() < p.skill) { p.wedges.add(t.id); toastSafe(`🤖 ${p.name} captura el quesito de ${t.roman ? 'Título ' + t.roman : t.name}`, 'ach-toast'); if (p.wedges.size >= SEG) { p.homing = true; toastSafe(`🤖 ${p.name} va al centro`, ''); } } }
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
    q.innerHTML = `<div class="triv-quiz-card triv-end"><div class="ts-emoji">${human ? '🏆' : '🤖'}</div>
      <h2>${human ? '¡Has ganado el Trivial!' : `Ganó ${T.players[winnerIdx].name}`}</h2>
      <p class="ts-score">Completaste ${T.players[0].wedges.size}/11 quesitos.</p>
      <div class="ts-actions"><button id="tqAgain" class="primary-btn">Otra partida 🎲</button><button id="tqMenu" class="secondary-btn">Volver al menú</button></div></div>`;
    if (human) { try { if (typeof confetti === 'function') confetti(); } catch { /* */ } }
    $('tqAgain').addEventListener('click', () => { $('trivQuiz').hidden = true; startTrivial(); });
    $('tqMenu').addEventListener('click', backToMenu);
    setTurn();
  }

  function backToMenu() { $('trivial').hidden = true; $('gameMenu').hidden = false; sfxSafe('click'); }
  function startTrivial() { $('gameMenu').hidden = true; $('trivQuiz').hidden = true; newGame(); buildBoard(); renderPlayers(); setTurn(); $('trivial').hidden = false; }
  window.startTrivial = startTrivial;

  const back = $('trivBack'); if (back) back.addEventListener('click', backToMenu);
})();
