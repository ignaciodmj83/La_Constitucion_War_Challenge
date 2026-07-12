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

  /* ═══════════════ costas orgánicas (islas de verdad, no rectángulos) ═══════════════ */
  const mulberry = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const seedOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  /* Contorno cerrado suave (Catmull-Rom → Bézier) */
  function closedSmooth(pts) {
    const n = pts.length;
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d + ' Z';
  }
  /* Silueta de isla: elipse deformada con varias octavas de ruido armónico
     (periódico → la costa cierra sin costuras), con cabos y bahías. */
  function islaPts(cx, cy, rx, ry, seed, rough) {
    const rnd = mulberry(seed);
    const oct = [];
    for (let k = 0; k < 4; k++) oct.push({ f: 2 + k + Math.floor(rnd() * 2), a: rough * (1 - k * 0.18) * (0.55 + rnd() * 0.75), p: rnd() * Math.PI * 2 });
    const pts = [];
    const n = 44;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      let f = 1; for (const o of oct) f += o.a * Math.sin(t * o.f + o.p);
      pts.push([cx + Math.cos(t) * rx * f, cy + Math.sin(t) * ry * f]);
    }
    return pts;
  }
  const islaPath = (cx, cy, rx, ry, seed, rough = 0.13) => closedSmooth(islaPts(cx, cy, rx, ry, seed, rough));
  /* Dibuja una isla completa: sombra, aguas someras, arena y playa. */
  function drawIsla(parent, cx, cy, rx, ry, seed, color, landFill) {
    parent.appendChild(el('ellipse', { cx, cy: cy + ry + 10, rx: rx * 0.92, ry: Math.max(10, ry * 0.22), fill: 'rgba(0,0,0,0.25)' }));
    parent.appendChild(el('path', { d: islaPath(cx, cy, rx * 1.22, ry * 1.26, seed + 7, 0.15), fill: 'rgba(180,225,235,0.14)' }));
    parent.appendChild(el('path', { d: islaPath(cx, cy, rx * 1.09, ry * 1.11, seed, 0.14), fill: '#e8dcae', opacity: 0.9 }));
    parent.appendChild(el('path', { d: islaPath(cx, cy, rx, ry, seed, 0.14), fill: landFill, stroke: color, 'stroke-width': 3 }));
  }
  /* Vegetación y relieve proporcionales al tamaño de la isla. */
  function decoraIsla(parent, cx, cy, rx, ry, seed, r) {
    const rnd = mulberry(seed + 99);
    const flora = ['🌴', '🌴', '🌲', '⛰️', '🪨', '🌿'];
    const k = Math.max(1, Math.round(r / 20));
    for (let i = 0; i < k; i++) {
      const a = rnd() * Math.PI * 2;
      const px = cx + Math.cos(a) * rx * (0.62 + rnd() * 0.2);
      const py = cy + Math.sin(a) * ry * (0.62 + rnd() * 0.2);
      const fs = Math.max(13, r * (0.24 + rnd() * 0.1));
      const t = el('text', { x: px.toFixed(0), y: py.toFixed(0), 'text-anchor': 'middle', 'font-size': fs.toFixed(0), opacity: 0.95 });
      t.textContent = flora[Math.floor(rnd() * flora.length)];
      parent.appendChild(t);
    }
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
      // tamaño proporcional al número de territorios (√área)
      const r = 26 + Math.sqrt(isla.arts.length) * 4.2;
      const rx = r * 1.22, ry = r * 0.9;
      const seed = seedOf(isla.id);
      const g = el('g', { class: 'isl-node' + (unlocked ? ' on' : '') });
      if (unlocked) { g.style.cursor = 'pointer'; g.addEventListener('click', () => enterTitulo(isla.id)); }
      if (!unlocked) g.setAttribute('opacity', 0.55);
      drawIsla(g, x, y - 4, rx, ry, seed, isla.color, 'url(#iland)');
      decoraIsla(g, x, y - 4, rx, ry, seed, r);
      const pr = Math.max(26, r * 0.62);
      portrait(g, isla.id, x, y - 4, pr, isla.color, isla.emblem);
      if (!unlocked) { g.appendChild(el('circle', { cx: x, cy: y - 4, r: pr + 3, fill: 'rgba(10,20,32,0.6)' })); const lk = el('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-size': pr * 0.8 }); lk.textContent = '🔒'; g.appendChild(lk); }
      // número romano
      if (isla.roman) { const bx = x + rx * 0.72, by = y - 4 - ry * 0.82; g.appendChild(el('circle', { cx: bx, cy: by, r: 15, fill: isla.color, stroke: '#fff', 'stroke-width': 2 })); const rt = el('text', { x: bx, y: by + 5, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 900, fill: '#fff' }); rt.textContent = isla.roman; g.appendChild(rt); }
      // progreso
      const oc = ownedCount(isla); const py = y - 4 + ry + 4;
      g.appendChild(el('rect', { x: x - 33, y: py, width: 66, height: 18, rx: 9, fill: '#173547', stroke: complete ? '#3fbf6f' : '#f4e4bd', 'stroke-width': 1.5 }));
      const pt = el('text', { x, y: py + 13, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, fill: complete ? '#7ee6a4' : '#f4e4bd' }); pt.textContent = complete ? '✓ completa' : `${oc}/${isla.arts.length}`; g.appendChild(pt);
      // nombre
      const label = (isla.roman ? isla.roman + '. ' : '') + isla.name;
      const w = Math.max(96, label.length * 7.6);
      g.appendChild(el('rect', { x: x - w / 2, y: py + 22, width: w, height: 28, rx: 8, fill: '#f0dfb4', stroke: '#7d6f3f', 'stroke-width': 1.2 }));
      const nm = el('text', { x, y: py + 41, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: '#2a1c0c' }); nm.textContent = label; g.appendChild(nm);
      if (i === 0 && !complete) badge(g, x, y - 4 - ry - 34, '#2f9e5f', 'START');
      svg.appendChild(g);
    });
    // FIN: La Unidad
    const [fx, fy] = POS[11]; const won = ISLAS.every(isComplete);
    const fr = 44, frx = fr * 1.22, fry = fr * 0.9, fseed = seedOf('unidad');
    const fg = el('g', won ? {} : { opacity: 0.6 });
    drawIsla(fg, fx, fy - 4, frx, fry, fseed, FIN.color, 'url(#iland)');
    decoraIsla(fg, fx, fy - 4, frx, fry, fseed, fr);
    portrait(fg, FIN.id, fx, fy - 4, 30, FIN.color, FIN.emblem);
    if (!won) fg.appendChild(el('circle', { cx: fx, cy: fy - 4, r: 33, fill: 'rgba(10,20,32,0.5)' }));
    badge(fg, fx, fy - 4 - fry - 34, '#c0392b', 'FIN 👑');
    const w = 150; fg.appendChild(el('rect', { x: fx - w / 2, y: fy - 4 + fry + 8, width: w, height: 28, rx: 8, fill: '#f0dfb4', stroke: '#7d6f3f', 'stroke-width': 1.2 }));
    const fn = el('text', { x: fx, y: fy - 4 + fry + 27, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: '#2a1c0c' }); fn.textContent = 'La Unidad de España'; fg.appendChild(fn);
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

  /* ── subdivisión de una isla en territorios-artículo (mini-Risk) ──
     Voronoi con relajación de Lloyd sobre la trama interior de la costa,
     fronteras onduladas por deformación con ruido, y contorno de cada
     territorio extraído con marching squares. Las semillas nacen en
     serpentina para que los artículos consecutivos queden vecinos. */
  const darken = (hex, p) => { const v = parseInt(hex.slice(1), 16); let r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255; r *= 1 - p; g *= 1 - p; b *= 1 - p; return `rgb(${r | 0},${g | 0},${b | 0})`; };
  const toPathC = (pts) => 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
  function chaikinC(pts) {
    const out = []; const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      out.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]]);
      out.push([0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
    }
    return out;
  }
  function dpSimplify(pts, tol) {
    if (pts.length < 4) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const st = [[0, pts.length - 1]];
    while (st.length) {
      const [a, b] = st.pop(); let dm = 0, im = -1;
      const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
      for (let i = a + 1; i < b; i++) {
        const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
        if (d > dm) { dm = d; im = i; }
      }
      if (dm > tol) { keep[im] = 1; st.push([a, im], [im, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  function msContour(lab, val, nx, ny, px, py, step) {
    const at = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny && lab[j * nx + i] === val) ? 1 : 0;
    const segs = new Map(); const key = (p) => p[0].toFixed(1) + ',' + p[1].toFixed(1);
    const add = (a, b) => { const k = key(a); if (!segs.has(k)) segs.set(k, []); segs.get(k).push(b); };
    for (let j = -1; j < ny; j++) for (let i = -1; i < nx; i++) {
      const tl = at(i, j), tr = at(i + 1, j), bl = at(i, j + 1), br = at(i + 1, j + 1);
      const c = tl * 8 + tr * 4 + br * 2 + bl; if (c === 0 || c === 15) continue;
      const x = px(i), y = py(j);
      const T = [x + step / 2, y], R = [x + step, y + step / 2], B = [x + step / 2, y + step], L = [x, y + step / 2];
      const cases = { 1: [[B, L]], 2: [[R, B]], 3: [[R, L]], 4: [[T, R]], 5: [[T, R], [B, L]], 6: [[T, B]], 7: [[T, L]], 8: [[L, T]], 9: [[B, T]], 10: [[L, T], [R, B]], 11: [[R, T]], 12: [[L, R]], 13: [[B, R]], 14: [[L, B]] };
      for (const [a, b] of cases[c]) add(a, b);
    }
    const loops = []; const used = new Set();
    for (const [start] of segs) {
      if (used.has(start)) continue;
      let cur = start.split(',').map(Number); const loop = [cur];
      while (true) {
        const k = key(cur); const nxs = segs.get(k); if (!nxs || !nxs.length) break;
        used.add(k); cur = nxs.shift();
        if (key(cur) === start) break; loop.push(cur);
        if (loop.length > 20000) break;
      }
      if (loop.length > 3) loops.push(loop);
    }
    loops.sort((a, b) => b.length - a.length);
    return loops[0] || [];
  }
  function territoriosDe(seed, cx0, cy0, rx, ry, arts) {
    const step = 4.5;
    const poly = islaPts(cx0, cy0, rx, ry, seed, 0.12);
    const x0 = cx0 - rx * 1.3, y0 = cy0 - ry * 1.35;
    const nx = Math.ceil((rx * 2.6) / step), ny = Math.ceil((ry * 2.7) / step);
    const px = (i) => x0 + (i + 0.5) * step, py = (j) => y0 + (j + 0.5) * step;
    const inPoly = (x, y) => { let ins = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const xi = poly[a][0], yi = poly[a][1], xj = poly[b][0], yj = poly[b][1]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
    const lab = new Int16Array(nx * ny).fill(-1);
    const cells = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (inPoly(px(i), py(j))) cells.push(j * nx + i);
    // ruido de deformación → fronteras internas onduladas
    const rndW = mulberry(seed + 51); const GW = 6;
    const gA = [], gB = [];
    for (let j = 0; j <= GW; j++) { const ra = [], rb = []; for (let i = 0; i <= GW; i++) { ra.push(rndW() * 2 - 1); rb.push(rndW() * 2 - 1); } gA.push(ra); gB.push(rb); }
    const noiseAt = (grid, x, y) => {
      let fx = (x - x0) / (nx * step) * GW, fy = (y - y0) / (ny * step) * GW;
      fx = Math.min(GW, Math.max(0, fx)); fy = Math.min(GW, Math.max(0, fy));
      const i0 = fx | 0, j0 = fy | 0, i1 = Math.min(GW, i0 + 1), j1 = Math.min(GW, j0 + 1);
      const tx = fx - i0, ty = fy - j0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = grid[j0][i0], b = grid[j0][i1], c = grid[j1][i0], d = grid[j1][i1];
      const top = a + (b - a) * sx; return top + ((c + (d - c) * sx) - top) * sy;
    };
    const WARPI = 11;
    // semillas en serpentina (artículos consecutivos → vecinos)
    const cols = Math.max(1, Math.round(Math.sqrt(arts.length * (rx / ry))));
    const rows = Math.ceil(arts.length / cols);
    const seeds = arts.map((n, k) => {
      const r = Math.floor(k / cols); let c = k % cols; if (r % 2 === 1) c = cols - 1 - c;
      const fx = cols === 1 ? 0 : ((c + 0.5) / cols) * 2 - 1;
      const fy = rows === 1 ? 0 : ((r + 0.5) / rows) * 2 - 1;
      return [cx0 + fx * rx * 0.62, cy0 + fy * ry * 0.62];
    });
    const assign = new Int16Array(cells.length);
    for (let it = 0; it < 9; it++) {
      for (let c = 0; c < cells.length; c++) {
        const idx = cells[c]; const bx = px(idx % nx), by = py((idx / nx) | 0);
        const x = bx + noiseAt(gA, bx, by) * WARPI, y = by + noiseAt(gB, bx, by) * WARPI;
        let best = 0, bd = Infinity;
        for (let s = 0; s < seeds.length; s++) { const d = (x - seeds[s][0]) ** 2 + (y - seeds[s][1]) ** 2; if (d < bd) { bd = d; best = s; } }
        assign[c] = best;
      }
      if (it === 8) break; // última pasada: solo asignar
      const sx = seeds.map(() => 0), sy = seeds.map(() => 0), sn = seeds.map(() => 0);
      for (let c = 0; c < cells.length; c++) { const k = assign[c]; const idx = cells[c]; sx[k] += px(idx % nx); sy[k] += py((idx / nx) | 0); sn[k]++; }
      for (let s = 0; s < seeds.length; s++) if (sn[s]) seeds[s] = [sx[s] / sn[s], sy[s] / sn[s]];
    }
    for (let c = 0; c < cells.length; c++) lab[cells[c]] = assign[c];
    // contorno y centroide de cada territorio
    return arts.map((n, k) => {
      const raw = msContour(lab, k, nx, ny, px, py, step);
      let d = '';
      if (raw.length > 3) d = toPathC(chaikinC(chaikinC(dpSimplify(raw, 1.1))));
      let sx = 0, sy = 0, cnt = 0;
      for (let c = 0; c < cells.length; c++) if (assign[c] === k) { const idx = cells[c]; sx += px(idx % nx); sy += py((idx / nx) | 0); cnt++; }
      return { n, d, cx: cnt ? sx / cnt : cx0, cy: cnt ? sy / cnt : cy0 };
    });
  }

  function enterTitulo(tid) { curTid = tid; sfxSafe('click'); renderTitulo(); }

  function renderTitulo() {
    view = 'titulo';
    const isla = ISLAS[idxOf(curTid)];
    const stage = $('islasStage'); stage.className = 'islas-stage islas-interior'; stage.innerHTML = '';
    $('islasProg').textContent = `${isla.roman ? 'Título ' + isla.roman + ' · ' : ''}${isla.name} · ${ownedCount(isla)}/${isla.arts.length}`;

    // ── layout: una isla grande por capítulo, tamaño ∝ nº de artículos ──
    const GAP = 56, MAXW = 960, TOP = 186, VBW = 1040;
    const chaps = isla.chapters.map((c) => {
      const r = Math.max(46, Math.sqrt(c.arts.length * 2400 / Math.PI));
      const rx = r * 1.16, ry = r * 0.86;
      return { c, r, rx, ry, w: rx * 2.5, h: ry * 2.55 };
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
      let x = (VBW - r.w) / 2; const rowH = Math.max(...r.items.map((c2) => c2.h));
      r.items.forEach((ch) => { ch.cx = x + ch.w / 2; ch.cy = cy + rowH / 2; x += ch.w + GAP; });
      cy += rowH + 96;
    });
    const placed = chaps;
    const VBH = Math.max(470, cy - 30);

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

    // rutas marítimas punteadas entre capítulos consecutivos
    for (let i = 0; i < placed.length - 1; i++) {
      const a = placed[i], b = placed[i + 1];
      const ax = a.cx + a.rx * 1.14, ay = a.cy, bx = b.cx - b.rx * 1.14, by = b.cy;
      svg.appendChild(el('path', { d: `M ${ax.toFixed(0)} ${ay.toFixed(0)} C ${(ax + 30).toFixed(0)} ${ay.toFixed(0)}, ${(bx - 30).toFixed(0)} ${by.toFixed(0)}, ${bx.toFixed(0)} ${by.toFixed(0)}`, fill: 'none', stroke: '#f4e4bd', 'stroke-width': 3, 'stroke-dasharray': '2 10', 'stroke-linecap': 'round', opacity: 0.7 }));
    }

    // cada capítulo = una isla grande DIVIDIDA en territorios-artículo
    const multi = isla.chapters.length > 1;
    placed.forEach((ch) => {
      const g = el('g');
      const cseed = seedOf(isla.id + ':' + ch.c.id);
      // costa: sombra + aguas someras + playa + tierra base
      g.appendChild(el('ellipse', { cx: ch.cx, cy: ch.cy + ch.ry + 14, rx: ch.rx * 0.94, ry: Math.max(10, ch.ry * 0.16), fill: 'rgba(0,0,0,0.22)' }));
      g.appendChild(el('path', { d: islaPath(ch.cx, ch.cy, ch.rx * 1.18, ch.ry * 1.22, cseed + 7, 0.13), fill: 'rgba(180,225,235,0.13)' }));
      g.appendChild(el('path', { d: islaPath(ch.cx, ch.cy, ch.rx * 1.08, ch.ry * 1.1, cseed, 0.12), fill: '#e8dcae', opacity: 0.9 }));
      g.appendChild(el('path', { d: islaPath(ch.cx, ch.cy, ch.rx, ch.ry, cseed, 0.12), fill: 'url(#iland2)' }));
      // territorios interiores (fronteras tipo Risk)
      const terrs = territoriosDe(cseed, ch.cx, ch.cy, ch.rx, ch.ry, ch.c.arts);
      terrs.forEach((t) => {
        if (!t.d) return;
        const owned = !!G.owned[t.n], atk = attackable(isla, t.n);
        const tg = el('g', { class: 'isl-terr' + (atk ? ' atk' : ''), style: atk ? 'cursor:pointer' : '' });
        const fill = owned ? isla.color : atk ? darken(isla.color, 0.45) : darken(isla.color, 0.74);
        tg.appendChild(el('path', { d: t.d, class: 'terr-shape', fill, stroke: owned ? 'rgba(255,255,255,0.6)' : atk ? '#f4e4bd' : 'rgba(10,20,32,0.55)', 'stroke-width': atk ? 2.6 : 1.4, 'stroke-linejoin': 'round' }));
        const lb = el('text', { x: t.cx.toFixed(1), y: (t.cy + 4).toFixed(1), 'text-anchor': 'middle', class: 'terr-num', 'font-size': 12 });
        lb.textContent = owned ? '✓' : t.n; tg.appendChild(lb);
        if (atk) { const ti = el('title'); ti.textContent = `Art. ${t.n} — ¡conquistar!`; tg.appendChild(ti); tg.addEventListener('click', () => openQuiz(t.n)); }
        g.appendChild(tg);
      });
      // línea de costa por encima de las fronteras internas
      g.appendChild(el('path', { d: islaPath(ch.cx, ch.cy, ch.rx, ch.ry, cseed, 0.12), fill: 'none', stroke: isla.color, 'stroke-width': 3 }));
      // palmera + emblema-faro
      const pal = el('text', { x: (ch.cx + ch.rx * 0.8).toFixed(0), y: (ch.cy + ch.ry * 0.95).toFixed(0), 'text-anchor': 'middle', 'font-size': 20 }); pal.textContent = '🌴'; g.appendChild(pal);
      const ex = ch.cx - ch.rx * 0.84, ey = ch.cy - ch.ry * 0.88;
      g.appendChild(el('circle', { cx: ex, cy: ey, r: 15, fill: '#fff', stroke: isla.color, 'stroke-width': 2.5 }));
      const lm = el('text', { x: ex, y: ey + 6, 'text-anchor': 'middle', 'font-size': 16 }); lm.textContent = isla.emblem; g.appendChild(lm);
      if (multi) {
        const lw = Math.max(90, ch.c.name.length * 7.4);
        const ly = ch.cy - ch.ry * 1.24 - 30;
        g.appendChild(el('rect', { x: ch.cx - lw / 2, y: ly, width: lw, height: 24, rx: 12, fill: 'rgba(14,28,43,0.85)', stroke: isla.color, 'stroke-width': 1.5 }));
        const cn = el('text', { x: ch.cx, y: ly + 17, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, fill: '#f0dfb4' }); cn.textContent = ch.c.name; g.appendChild(cn);
      }
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
