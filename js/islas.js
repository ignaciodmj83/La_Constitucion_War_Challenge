/* =========================================================================
   Juego 5: "Islas" — aventura por islas en orden ascendente de títulos.
   - MUNDO: ruta de islas (una por título, Preliminar → X) hasta La Unidad.
     Las islas se desbloquean en orden: completa una para abrir la siguiente.
   - INTERIOR de una isla (título): sus capítulos son SUB-ISLAS; cada artículo
     es un TERRITORIO que se conquista uno a uno (tipo Risk, en cadena) con una
     pregunta. Al conquistar todos, la isla queda completada y se abre la
     siguiente en el mundo.
   Progreso propio (localStorage). Reutiliza TITULOS, ARTICLES, PERSONAJES,
   sfx, toast, confetti, S.stats/save/touchActivity si existen.
   ========================================================================= */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const el = (t, a = {}) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const sfxSafe = (k) => { try { if (typeof sfx !== 'undefined' && sfx[k]) sfx[k](); } catch { /* */ } };
  const toastSafe = (m, c) => { try { if (typeof toast === 'function') toast(m, c); } catch { /* */ } };
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const range = (r) => { const [a, b] = r; const o = []; for (let n = a; n <= b; n++) o.push(n); return o; };

  /* ── títulos conquistables (Preliminar..X) + destino final La Unidad ── */
  const ISLAS = TITULOS.map((t) => ({
    id: t.id, roman: t.roman, name: t.name, color: t.color, emblem: t.emblem,
    chapters: t.islands.map((is) => ({ id: is.id, name: is.name, arts: range(is.arts) })),
    arts: t.islands.flatMap((is) => range(is.arts)),
  }));
  const FIN = { id: 'unidad', name: 'La Unidad de España', color: '#c9a13b', emblem: '🛡️' };
  const idxOf = (tid) => ISLAS.findIndex((x) => x.id === tid);

  /* ── estado ── */
  const KEY = 'ce78_islas_v1';
  const DIFF = {
    facil: { name: 'Fácil', emoji: '🌱', opts: 2, desc: '2 opciones' },
    medio: { name: 'Medio', emoji: '⚔️', opts: 3, desc: '3 opciones' },
    dificil: { name: 'Difícil', emoji: '🔥', opts: 4, desc: 'todas las opciones' },
  };
  function load() {
    try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && o.owned) { if (!DIFF[o.diff]) o.diff = 'medio'; return o; } } catch { /* */ }
    return { diff: 'medio', owned: {} };
  }
  let G = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(G)); } catch { /* */ } };

  const ownedCount = (isla) => isla.arts.filter((n) => G.owned[n]).length;
  const isComplete = (isla) => ownedCount(isla) === isla.arts.length;
  const isUnlocked = (i) => i === 0 || isComplete(ISLAS[i - 1]);
  const totalOwned = () => Object.keys(G.owned).length;

  let view = 'mundo', curTid = null;

  /* ═══════════════ barra de dificultad ═══════════════ */
  function renderDiff() {
    const bar = $('islasDiffBar'); if (!bar) return;
    bar.innerHTML = Object.entries(DIFF).map(([k, d]) =>
      `<button class="mem-diff ${G.diff === k ? 'sel' : ''}" data-d="${k}"><b>${d.emoji} ${d.name}</b><small>${d.desc}</small></button>`).join('');
    bar.querySelectorAll('.mem-diff').forEach((b) => b.addEventListener('click', () => { G.diff = b.dataset.d; save(); sfxSafe('click'); renderDiff(); }));
  }

  /* ═══════════════ util SVG: retrato del guardián recortado ═══════════════ */
  let clipSeq = 0;
  function portrait(parent, tid, cx, cy, r, color, emblem) {
    const cid = 'islclip' + (clipSeq++);
    const cp = el('clipPath', { id: cid }); cp.appendChild(el('circle', { cx, cy, r })); parent.appendChild(cp);
    parent.appendChild(el('circle', { cx, cy, r: r + 4, fill: '#0e1c2b', stroke: color, 'stroke-width': 4 }));
    const fb = el('text', { x: cx, y: cy + r * 0.34, 'text-anchor': 'middle', 'font-size': r, opacity: 0 }); fb.textContent = emblem;
    const img = el('image', { x: cx - r, y: cy - r, width: r * 2, height: r * 2, 'clip-path': `url(#${cid})`, preserveAspectRatio: 'xMidYMid slice' });
    img.setAttribute('href', `assets/personajes/${tid}.png`);
    img.addEventListener('error', () => { img.style.display = 'none'; fb.setAttribute('opacity', 1); });
    parent.appendChild(fb); parent.appendChild(img);
  }

  /* ═══════════════ MUNDO: ruta de islas ═══════════════ */
  const POS = [
    [150, 620], [420, 610], [690, 615], [955, 595],
    [1000, 400], [740, 415], [470, 400], [180, 400],
    [300, 200], [545, 190], [795, 205], [1050, 135],
  ];
  function smooth(pts) {
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0]} ${p2[1]}`;
    }
    return d;
  }
  function renderWorld() {
    view = 'mundo';
    const stage = $('islasStage'); stage.className = 'islas-stage islas-world'; stage.innerHTML = '';
    const done = ISLAS.filter(isComplete).length;
    $('islasProg').textContent = `Isla ${Math.min(done + 1, ISLAS.length)}/${ISLAS.length} · ${totalOwned()}/169 territorios`;

    const svg = el('svg', { viewBox: '0 0 1200 720', class: 'islas-svg' });
    const defs = el('defs');
    defs.innerHTML = `
      <radialGradient id="isea" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="#2f6f8f"/><stop offset="0.55" stop-color="#1f5473"/><stop offset="1" stop-color="#143a52"/></radialGradient>
      <radialGradient id="iland" cx="45%" cy="35%" r="75%"><stop offset="0" stop-color="#d8c58a"/><stop offset="0.6" stop-color="#b7a86a"/><stop offset="1" stop-color="#8f8450"/></radialGradient>
      <filter id="ish" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000" flood-opacity="0.45"/></filter>`;
    svg.appendChild(defs);
    svg.appendChild(el('rect', { x: 0, y: 0, width: 1200, height: 720, fill: 'url(#isea)' }));
    let waves = ''; for (let r = 0; r < 6; r++) { const y = 110 + r * 110; waves += `<path d="M0 ${y} q 40 -12 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="2"/>`; }
    const wg = el('g'); wg.innerHTML = waves; svg.appendChild(wg);

    const all = ISLAS.map((x, i) => [POS[i][0], POS[i][1]]); all.push(POS[11]);
    const pathD = smooth(all);
    svg.appendChild(el('path', { d: pathD, fill: 'none', stroke: 'rgba(0,0,0,0.28)', 'stroke-width': 11, 'stroke-linecap': 'round' }));
    svg.appendChild(el('path', { d: pathD, fill: 'none', stroke: '#f4e4bd', 'stroke-width': 4.5, 'stroke-linecap': 'round', 'stroke-dasharray': '2 15' }));

    ISLAS.forEach((isla, i) => {
      const [x, y] = POS[i]; const unlocked = isUnlocked(i); const complete = isComplete(isla);
      const g = el('g', { filter: 'url(#ish)', class: 'isl-node' + (unlocked ? ' on' : '') });
      if (unlocked) { g.style.cursor = 'pointer'; g.addEventListener('click', () => enterTitulo(isla.id)); }
      g.appendChild(el('ellipse', { cx: x, cy: y + 34, rx: 62, ry: 20, fill: 'rgba(0,0,0,0.25)' }));
      g.appendChild(el('circle', { cx: x, cy: y - 4, r: 52, fill: 'url(#iland)', stroke: '#7d6f3f', 'stroke-width': 2, opacity: unlocked ? 1 : 0.5 }));
      portrait(g, isla.id, x, y - 4, 40, isla.color, isla.emblem);
      if (!unlocked) { g.appendChild(el('circle', { cx: x, cy: y - 4, r: 44, fill: 'rgba(10,20,32,0.6)' })); const lk = el('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-size': 34 }); lk.textContent = '🔒'; g.appendChild(lk); }
      // número romano
      if (isla.roman) { g.appendChild(el('circle', { cx: x + 34, cy: y - 36, r: 15, fill: isla.color, stroke: '#fff', 'stroke-width': 2 })); const rt = el('text', { x: x + 34, y: y - 30, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 900, fill: '#fff' }); rt.textContent = isla.roman; g.appendChild(rt); }
      // progreso
      const oc = ownedCount(isla);
      g.appendChild(el('rect', { x: x - 30, y: y + 26, width: 60, height: 18, rx: 9, fill: '#173547', stroke: complete ? '#3fbf6f' : '#f4e4bd', 'stroke-width': 1.5 }));
      const pt = el('text', { x, y: y + 39, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, fill: complete ? '#7ee6a4' : '#f4e4bd' }); pt.textContent = complete ? '✓ completa' : `${oc}/${isla.arts.length}`; g.appendChild(pt);
      // nombre
      const label = (isla.roman ? isla.roman + '. ' : '') + isla.name;
      const w = Math.max(96, label.length * 7.6);
      g.appendChild(el('rect', { x: x - w / 2, y: y + 48, width: w, height: 28, rx: 8, fill: '#f0dfb4', stroke: '#7d6f3f', 'stroke-width': 1.2 }));
      const nm = el('text', { x, y: y + 67, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: '#2a1c0c' }); nm.textContent = label; g.appendChild(nm);
      if (i === 0 && !complete) badge(g, x, y - 72, '#2f9e5f', 'START');
      svg.appendChild(g);
    });
    // FIN: La Unidad
    const [fx, fy] = POS[11]; const won = ISLAS.every(isComplete);
    const fg = el('g', { filter: 'url(#ish)' });
    fg.appendChild(el('circle', { cx: fx, cy: fy - 4, r: 52, fill: 'url(#iland)', stroke: '#7d6f3f', 'stroke-width': 2, opacity: won ? 1 : 0.55 }));
    portrait(fg, FIN.id, fx, fy - 4, 40, FIN.color, FIN.emblem);
    if (!won) fg.appendChild(el('circle', { cx: fx, cy: fy - 4, r: 44, fill: 'rgba(10,20,32,0.5)' }));
    badge(fg, fx, fy - 72, '#c0392b', 'FIN 👑');
    const w = 130; fg.appendChild(el('rect', { x: fx - w / 2, y: fy + 48, width: w, height: 28, rx: 8, fill: '#f0dfb4', stroke: '#7d6f3f', 'stroke-width': 1.2 }));
    const fn = el('text', { x: fx, y: fy + 67, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: '#2a1c0c' }); fn.textContent = 'La Unidad de España'; fg.appendChild(fn);
    svg.appendChild(fg);

    stage.appendChild(svg);
    if (won) setTimeout(() => victory(), 300);
  }
  function badge(g, x, y, fill, txt) {
    const w = txt.length * 9 + 20;
    g.appendChild(el('rect', { x: x - w / 2, y: y, width: w, height: 26, rx: 13, fill, stroke: '#fff', 'stroke-width': 2 }));
    const t = el('text', { x, y: y + 18, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 900, fill: '#fff' }); t.textContent = txt; g.appendChild(t);
  }

  /* ═══════════════ INTERIOR: capítulos = sub-islas, artículos = territorios ═══════════════ */
  const attackable = (isla, n) => !G.owned[n] && (n === isla.arts[0] || G.owned[n - 1]);

  function enterTitulo(tid) { curTid = tid; sfxSafe('click'); renderTitulo(); }

  function renderTitulo() {
    view = 'titulo';
    const isla = ISLAS[idxOf(curTid)];
    const stage = $('islasStage'); stage.className = 'islas-stage islas-interior'; stage.innerHTML = '';
    $('islasProg').textContent = `${isla.roman ? 'Título ' + isla.roman + ' · ' : ''}${isla.name} · ${ownedCount(isla)}/${isla.arts.length}`;

    // ── layout: empaquetar sub-islas (capítulos) en filas centradas ──
    const PAD = 26, CELL = 40, GAP = 46, MAXW = 980, TOP = 150, VBW = 1040;
    const chaps = isla.chapters.map((c) => {
      const cols = Math.max(2, Math.min(6, Math.ceil(Math.sqrt(c.arts.length * 1.5))));
      const rows = Math.ceil(c.arts.length / cols);
      return { c, cols, rows, w: cols * CELL + PAD * 2, h: rows * CELL + 44 };
    });
    const rowsArr = []; let row = [], rw = 0;
    chaps.forEach((ch) => {
      const add = (row.length ? GAP : 0) + ch.w;
      if (rw + add > MAXW && row.length) { rowsArr.push({ items: row, w: rw }); row = []; rw = 0; }
      row.push(ch); rw += (row.length > 1 ? GAP : 0) + ch.w;
    });
    if (row.length) rowsArr.push({ items: row, w: rw });
    let cy = TOP;
    rowsArr.forEach((r) => {
      let x = (VBW - r.w) / 2, rowH = 0;
      r.items.forEach((ch) => { ch.x = x; ch.y = cy; x += ch.w + GAP; rowH = Math.max(rowH, ch.h); });
      cy += rowH + 50;
    });
    const placed = chaps;
    const VBH = Math.max(430, cy + 6);

    const svg = el('svg', { viewBox: `0 0 ${VBW} ${VBH}`, class: 'islas-svg' });
    const defs = el('defs');
    defs.innerHTML = `
      <radialGradient id="isea2" cx="50%" cy="30%" r="90%"><stop offset="0" stop-color="#2f6f8f"/><stop offset="0.6" stop-color="#1c4e6c"/><stop offset="1" stop-color="#123449"/></radialGradient>
      <radialGradient id="iland2" cx="45%" cy="30%" r="80%"><stop offset="0" stop-color="#e0cd91"/><stop offset="0.62" stop-color="#bda86a"/><stop offset="1" stop-color="#8d7f4a"/></radialGradient>
      <filter id="ish2" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.4"/></filter>`;
    svg.appendChild(defs);
    svg.appendChild(el('rect', { x: 0, y: 0, width: VBW, height: VBH, fill: 'url(#isea2)' }));
    let waves = ''; for (let r = 0; r < Math.ceil(VBH / 120); r++) { const y = 90 + r * 120; waves += `<path d="M0 ${y} q 40 -12 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0" fill="none" stroke="rgba(255,255,255,0.045)" stroke-width="2"/>`; }
    const wg = el('g'); wg.innerHTML = waves; svg.appendChild(wg);

    // cabecera: guardián + banner del título
    portrait(svg, isla.id, 74, 74, 52, isla.color, isla.emblem);
    svg.appendChild(el('rect', { x: 150, y: 40, width: 720, height: 68, rx: 14, fill: 'rgba(14,28,43,0.72)', stroke: isla.color, 'stroke-width': 2 }));
    const bt = el('text', { x: 172, y: 76, 'font-size': 24, 'font-weight': 900, fill: '#fff' }); bt.textContent = `${isla.roman ? 'Título ' + isla.roman + ' · ' : ''}${isla.name}`; svg.appendChild(bt);
    const bs = el('text', { x: 172, y: 98, 'font-size': 13, fill: '#9fb3cc' }); bs.textContent = isComplete(isla) ? '✓ Isla completada — repasa los territorios' : 'Conquista los territorios en orden respondiendo su pregunta'; svg.appendChild(bs);

    // puentes punteados entre capítulos consecutivos
    for (let i = 0; i < placed.length - 1; i++) {
      const a = placed[i], b = placed[i + 1];
      svg.appendChild(el('path', { d: `M ${(a.x + a.w).toFixed(0)} ${(a.y + a.h / 2).toFixed(0)} C ${(a.x + a.w + 20)} ${(a.y + a.h / 2)}, ${(b.x - 20)} ${(b.y + b.h / 2)}, ${b.x} ${(b.y + b.h / 2).toFixed(0)}`, fill: 'none', stroke: '#f4e4bd', 'stroke-width': 3, 'stroke-dasharray': '2 10', 'stroke-linecap': 'round', opacity: 0.7 }));
    }

    // cada capítulo = sub-isla con sus territorios
    placed.forEach((ch) => {
      const g = el('g', { filter: 'url(#ish2)' });
      const multi = isla.chapters.length > 1;
      g.appendChild(el('ellipse', { cx: ch.x + ch.w / 2, cy: ch.y + ch.h + 6, rx: ch.w / 2, ry: 14, fill: 'rgba(0,0,0,0.22)' }));
      g.appendChild(el('rect', { x: ch.x, y: ch.y, width: ch.w, height: ch.h, rx: Math.min(ch.w, ch.h) / 2.6, fill: 'url(#iland2)', stroke: isla.color, 'stroke-width': 3 }));
      // emblema-faro de la isla
      g.appendChild(el('circle', { cx: ch.x + 20, cy: ch.y + 20, r: 15, fill: '#fff', stroke: isla.color, 'stroke-width': 2.5 }));
      const lm = el('text', { x: ch.x + 20, y: ch.y + 26, 'text-anchor': 'middle', 'font-size': 16 }); lm.textContent = isla.emblem; g.appendChild(lm);
      if (multi) { const cn = el('text', { x: ch.x + ch.w / 2, y: ch.y - 8, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: '#f0dfb4' }); cn.textContent = ch.c.name; g.appendChild(cn); }
      // serpentina de celdas + camino
      const pts = ch.c.arts.map((n, k) => {
        const row = Math.floor(k / ch.cols); let col = k % ch.cols; if (row % 2 === 1) col = ch.cols - 1 - col;
        return [ch.x + PAD + col * CELL + CELL / 2, ch.y + 30 + row * CELL + CELL / 2, n];
      });
      for (let k = 0; k < pts.length - 1; k++) g.appendChild(el('line', { x1: pts[k][0], y1: pts[k][1], x2: pts[k + 1][0], y2: pts[k + 1][1], stroke: 'rgba(0,0,0,0.22)', 'stroke-width': 3 }));
      pts.forEach(([px, py, n]) => {
        const owned = !!G.owned[n], atk = attackable(isla, n);
        const cell = el('g', { class: 'isl-terr' + (atk ? ' atk' : ''), style: atk ? 'cursor:pointer' : '' });
        cell.appendChild(el('circle', { cx: px, cy: py, r: 15, fill: owned ? isla.color : atk ? '#0e1c2b' : '#26364a', stroke: owned ? '#fff' : atk ? '#f4e4bd' : '#3a4a60', 'stroke-width': owned ? 2 : atk ? 3 : 1.5 }));
        const tn = el('text', { x: px, y: py + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, fill: owned ? '#fff' : atk ? '#f4e4bd' : '#8fa0b8' }); tn.textContent = owned ? '✓' : n; cell.appendChild(tn);
        if (atk) { const t = el('title'); t.textContent = `Art. ${n} — ¡conquistar!`; cell.appendChild(t); cell.addEventListener('click', () => openQuiz(n)); }
        g.appendChild(cell);
      });
      svg.appendChild(g);
    });
    stage.appendChild(svg);
  }

  /* ═══════════════ conquista de un territorio (pregunta) ═══════════════ */
  function openQuiz(n) {
    const isla = ISLAS[idxOf(curTid)]; const a = ARTICLES[n]; if (!a) return;
    const nopts = DIFF[G.diff].opts;
    let opts;
    if (nopts >= a.o.length) opts = a.o.map((_, i) => i);
    else { const wrong = shuffle(a.o.map((_, i) => i).filter((i) => i !== a.c)).slice(0, nopts - 1); opts = shuffle([a.c, ...wrong]); }
    if (nopts >= a.o.length) opts = shuffle(opts);
    const emb = (a.img && a.img[0]) || isla.emblem;
    const ov = $('islasQuiz');
    ov.innerHTML = `<div class="card islas-quiz-card" style="--tc:${isla.color}">
      <button class="card-close" data-close="islasQuiz">✕</button>
      <div class="iq-head"><span class="iq-sym" style="background:${isla.color}">${emb}</span>
        <div><div class="iq-art">Art. ${n}${isla.roman ? ' · Título ' + isla.roman : ''}</div><div class="iq-t">${a.t}</div></div></div>
      <p class="iq-q">${a.q}</p>
      <div class="iq-opts" id="iqOpts"></div>
      <div class="iq-fb" id="iqFb" hidden></div>
    </div>`;
    const box = $('iqOpts');
    opts.forEach((oi) => { const b = document.createElement('button'); b.className = 'iq-opt'; b.textContent = a.o[oi]; b.addEventListener('click', () => answer(oi, n, a, box)); box.appendChild(b); });
    ov.hidden = false;
  }
  function answer(oi, n, a, box) {
    const isla = ISLAS[idxOf(curTid)]; const correct = oi === a.c;
    [...box.children].forEach((ch, k) => { ch.disabled = true; });
    [...box.children].forEach((ch) => { if (ch.textContent === a.o[a.c]) ch.classList.add('ok'); else if (ch.textContent === a.o[oi] && !correct) ch.classList.add('bad'); });
    const fb = $('iqFb'); fb.hidden = false; fb.className = 'iq-fb ' + (correct ? 'ok' : 'bad');
    if (correct) {
      G.owned[n] = true; save(); sfxSafe('correct');
      try { if (typeof S !== 'undefined') { S.stats.mastered = S.stats.mastered || {}; S.stats.mastered[n] = true; } if (typeof touchActivity === 'function') touchActivity(); if (typeof window.save === 'function') window.save(); } catch { /* */ }
    } else sfxSafe('wrong');
    fb.innerHTML = `<div class="iq-verdict">${correct ? '✅ ¡Territorio conquistado!' : '❌ No es correcto'}</div>
      <p class="iq-why">${a.e}</p>
      <button id="iqNext" class="primary-btn">${correct ? 'Seguir ➜' : 'Reintentar más tarde'}</button>`;
    $('iqNext').addEventListener('click', () => {
      $('islasQuiz').hidden = true;
      renderTitulo();
      if (correct && isComplete(isla)) islaCompletada(isla);
    });
    $('iqNext').focus();
  }

  function islaCompletada(isla) {
    try { if (typeof confetti === 'function') confetti(); } catch { /* */ }
    const next = ISLAS[idxOf(isla.id) + 1];
    const ov = $('islasQuiz');
    ov.innerHTML = `<div class="card islas-end" style="--tc:${isla.color}">
      <div class="ie-emoji">🏝️✨</div>
      <h2>¡Isla completada!</h2>
      <p>Has conquistado <b>${isla.name}</b>.</p>
      <p class="ie-next">${next ? `Se ha desbloqueado la siguiente isla: <b>${next.roman ? 'Título ' + next.roman + ' · ' : ''}${next.name}</b>.` : '¡Has llegado a <b>La Unidad de España</b>!'}</p>
      <button id="ieOk" class="primary-btn big">Al mapa 🗺️</button>
    </div>`;
    ov.hidden = false;
    $('ieOk').addEventListener('click', () => { ov.hidden = true; renderWorld(); });
  }

  function victory() {
    const ov = $('islasQuiz'); if (!ov || !ov.hidden) return;
    const art = (typeof PERSONAJES !== 'undefined') ? PERSONAJES.portrait('unidad', 'sm') : '👑';
    ov.innerHTML = `<div class="card islas-end" style="--tc:#c9a13b">
      ${art}<h2>👑 ¡Has unido toda España!</h2>
      <p>Conquistaste los 169 territorios de las 11 islas y alcanzaste <b>La Unidad de España</b>.</p>
      <button id="ieOk" class="primary-btn big">Volver al menú</button>
    </div>`;
    ov.hidden = false;
    try { if (typeof confetti === 'function') confetti(); } catch { /* */ }
    $('ieOk').addEventListener('click', () => { ov.hidden = true; backToMenu(); });
  }

  /* ═══════════════ arranque / navegación ═══════════════ */
  function backToMenu() { $('islas').hidden = true; $('gameMenu').hidden = false; sfxSafe('click'); }
  function startIslas() { $('gameMenu').hidden = true; $('islasQuiz').hidden = true; G = load(); renderDiff(); renderWorld(); $('islas').hidden = false; }
  window.startIslas = startIslas;

  document.addEventListener('DOMContentLoaded', () => {
    const back = $('islasBack');
    if (back) back.addEventListener('click', () => { if (view === 'titulo') { sfxSafe('click'); renderWorld(); } else backToMenu(); });
  });
})();
