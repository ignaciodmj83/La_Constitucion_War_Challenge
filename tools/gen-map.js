/* Generador del continente "Constitucia": Voronoi ponderado por nº de artículos.
   Produce map-data.js con paths SVG, centroides, áreas y adyacencias. */
'use strict';
const fs = require('fs');
const path = require('path');

const W = 1200, H = 860, STEP = 4;

/* Silueta del continente (sentido horario). Mar a la derecha para las islas. */
const MAINLAND = [
  [180, 100], [300, 58], [420, 118], [520, 66], [640, 104], [760, 60],
  [868, 112], [922, 190], [900, 268], [944, 350], [912, 440], [934, 530],
  [872, 606], [896, 690], [788, 768], [660, 736], [556, 796], [430, 762],
  [300, 802], [196, 724], [118, 618], [148, 516], [86, 428], [128, 326], [96, 214],
];

/* Artículos por territorio continental (169 total; TC=7 y Reforma=4 son islas). */
const ARTS = {
  preliminar: 9, dignidad: 5, derechos: 15, deberes: 9, rectores: 14,
  garantias: 3, corona: 10, cortes: 31, relaciones: 9, gobierno: 11,
  judicial: 11, economia: 9, territorial: 22,
};

/* Semillas iniciales (geografía deseada). */
const SEEDS = {
  corona: [480, 160], relaciones: [840, 180], cortes: [690, 290],
  gobierno: [860, 430], judicial: [760, 660], preliminar: [470, 340],
  dignidad: [320, 290], derechos: [190, 230], deberes: [180, 430],
  garantias: [300, 470], rectores: [230, 600], economia: [450, 550],
  territorial: [470, 700],
};

const ISLANDS = {
  tc: { c: [1070, 420], arts: 7, seed: 7 },
  reforma: { c: [1040, 670], arts: 4, seed: 4 },
};

const SEA_ROUTES = [['tc', 'judicial'], ['tc', 'reforma'], ['reforma', 'territorial']];

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ── rejilla ── */
const nx = Math.floor(W / STEP), ny = Math.floor(H / STEP);
const cx = (i) => i * STEP + STEP / 2, cy = (j) => j * STEP + STEP / 2;
const inside = new Uint8Array(nx * ny);
let totalCells = 0;
for (let j = 0; j < ny; j++)
  for (let i = 0; i < nx; i++)
    if (inPoly(cx(i), cy(j), MAINLAND)) { inside[j * nx + i] = 1; totalCells++; }

const ids = Object.keys(SEEDS);
const totalArts = ids.reduce((s, k) => s + ARTS[k], 0);
const target = ids.map((k) => (ARTS[k] / totalArts) * totalCells);
const pos = ids.map((k) => SEEDS[k].slice());
const w = ids.map(() => 0);
const label = new Int16Array(nx * ny).fill(-1);

function assign() {
  const areas = ids.map(() => 0);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const idx = j * nx + i;
    if (!inside[idx]) continue;
    const x = cx(i), y = cy(j);
    let best = -1, bd = Infinity;
    for (let k = 0; k < ids.length; k++) {
      const dx = x - pos[k][0], dy = y - pos[k][1];
      const d = dx * dx + dy * dy - w[k];
      if (d < bd) { bd = d; best = k; }
    }
    label[idx] = best;
    areas[best]++;
  }
  return areas;
}

for (let it = 0; it < 160; it++) {
  const areas = assign();
  for (let k = 0; k < ids.length; k++) {
    w[k] += 900 * ((target[k] - areas[k]) / target[k]);
  }
  if (it % 10 === 9 && it < 120) { // Lloyd suave: centroides
    const sx = ids.map(() => 0), sy = ids.map(() => 0), n = ids.map(() => 0);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = label[j * nx + i];
      if (k >= 0) { sx[k] += cx(i); sy[k] += cy(j); n[k]++; }
    }
    for (let k = 0; k < ids.length; k++) if (n[k]) {
      pos[k][0] = pos[k][0] * 0.4 + (sx[k] / n[k]) * 0.6;
      pos[k][1] = pos[k][1] * 0.4 + (sy[k] / n[k]) * 0.6;
    }
  }
}
let areas = assign();

/* ── conectividad: reasignar fragmentos sueltos al vecino mayoritario ── */
function fixFragments() {
  let changed = false;
  for (let k = 0; k < ids.length; k++) {
    const seen = new Int32Array(nx * ny).fill(-1);
    const comps = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const idx = j * nx + i;
      if (label[idx] !== k || seen[idx] >= 0) continue;
      const comp = [idx]; seen[idx] = comps.length;
      for (let p = 0; p < comp.length; p++) {
        const c = comp[p], ci = c % nx, cj = (c / nx) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const nidx = nj * nx + ni;
          if (label[nidx] === k && seen[nidx] < 0) { seen[nidx] = comps.length; comp.push(nidx); }
        }
      }
      comps.push(comp);
    }
    if (comps.length <= 1) continue;
    comps.sort((a, b) => b.length - a.length);
    for (let c = 1; c < comps.length; c++) {
      for (const idx of comps[c]) {
        const ci = idx % nx, cj = (idx / nx) | 0;
        const votes = {};
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const l = label[nj * nx + ni];
          if (l >= 0 && l !== k) votes[l] = (votes[l] || 0) + 1;
        }
        const bestOther = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
        if (bestOther) { label[idx] = Number(bestOther[0]); changed = true; }
      }
    }
  }
  return changed;
}
for (let r = 0; r < 8 && fixFragments(); r++);
areas = ids.map(() => 0);
for (let idx = 0; idx < nx * ny; idx++) if (label[idx] >= 0) areas[label[idx]]++;

/* ── marching squares por etiqueta (contornos compartidos entre vecinos) ── */
function contour(k) {
  const val = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny && label[j * nx + i] === k) ? 1 : 0;
  const segs = new Map(); // clave punto inicio → [fin,...]
  const key = (p) => `${p[0]},${p[1]}`;
  const addSeg = (a, b) => {
    const ka = key(a);
    if (!segs.has(ka)) segs.set(ka, []);
    segs.get(ka).push(b);
  };
  for (let j = -1; j < ny; j++) for (let i = -1; i < nx; i++) {
    const tl = val(i, j), tr = val(i + 1, j), bl = val(i, j + 1), br = val(i + 1, j + 1);
    const c = tl * 8 + tr * 4 + br * 2 + bl;
    if (c === 0 || c === 15) continue;
    const x = cx(i), y = cy(j);
    const T = [x + STEP / 2, y], R = [x + STEP, y + STEP / 2], B = [x + STEP / 2, y + STEP], L = [x, y + STEP / 2];
    // segmentos orientados con el interior a la izquierda
    const cases = {
      1: [[B, L]], 2: [[R, B]], 3: [[R, L]], 4: [[T, R]], 5: [[T, R], [B, L]],
      6: [[T, B]], 7: [[T, L]], 8: [[L, T]], 9: [[B, T]], 10: [[L, T], [R, B]],
      11: [[R, T]], 12: [[L, R]], 13: [[B, R]], 14: [[L, B]],
    };
    for (const [a, b] of cases[c]) addSeg(a, b);
  }
  // encadenar bucles; devolver el más largo
  const loops = [];
  const used = new Set();
  for (const [start] of segs) {
    if (used.has(start)) continue;
    let cur = start.split(',').map(Number);
    const loop = [cur];
    while (true) {
      const k2 = key(cur);
      const nexts = segs.get(k2);
      if (!nexts || !nexts.length) break;
      const nxt = nexts.shift();
      used.add(k2);
      cur = nxt;
      if (key(cur) === start) break;
      loop.push(cur);
      if (loop.length > 100000) break;
    }
    if (loop.length > 3) loops.push(loop);
  }
  loops.sort((a, b) => b.length - a.length);
  return loops[0] || [];
}

function dpSimplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let dmax = 0, imax = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > dmax) { dmax = d; imax = i; }
    }
    if (dmax > tol) { keep[imax] = 1; stack.push([a, imax], [imax, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function chaikin(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    out.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]]);
    out.push([0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
  }
  return out;
}

function toPath(pts) {
  return 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + 'Z';
}

const land = {}, centers = {}, cellArea = {};
for (let k = 0; k < ids.length; k++) {
  let pts = contour(k);
  pts = dpSimplify(pts, 2.2);
  pts = chaikin(chaikin(pts));
  pts = dpSimplify(pts, 0.9);
  land[ids[k]] = toPath(pts);
  // centroide de celdas
  let sx = 0, sy = 0, n = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    if (label[j * nx + i] === k) { sx += cx(i); sy += cy(j); n++; }
  centers[ids[k]] = [Math.round(sx / n), Math.round(sy / n)];
  cellArea[ids[k]] = n * STEP * STEP;
}

/* ── islas: blobs con área proporcional ── */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const unit = totalCells * STEP * STEP / totalArts; // px² por artículo
for (const [id, isl] of Object.entries(ISLANDS)) {
  const A = isl.arts * unit;
  const r0 = Math.sqrt(A / Math.PI);
  const rnd = mulberry(isl.seed * 7919);
  const n = 12, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const jr = 0.8 + rnd() * 0.4;
    pts.push([isl.c[0] + Math.cos(a) * r0 * 1.12 * jr, isl.c[1] + Math.sin(a) * r0 * 0.92 * jr]);
  }
  const sm = chaikin(chaikin(pts));
  land[id] = toPath(sm);
  centers[id] = isl.c;
  cellArea[id] = Math.round(A);
}

/* ── adyacencias continentales + rutas marítimas ── */
const adjSet = {};
for (const id of [...ids, ...Object.keys(ISLANDS)]) adjSet[id] = new Set();
for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
  const a = label[j * nx + i];
  if (a < 0) continue;
  for (const [di, dj] of [[1, 0], [0, 1]]) {
    const ni = i + di, nj = j + dj;
    if (ni >= nx || nj >= ny) continue;
    const b = label[nj * nx + ni];
    if (b >= 0 && b !== a) { adjSet[ids[a]].add(ids[b]); adjSet[ids[b]].add(ids[a]); }
  }
}
for (const [a, b] of SEA_ROUTES) { adjSet[a].add(b); adjSet[b].add(a); }
const adj = Object.fromEntries(Object.entries(adjSet).map(([k, v]) => [k, [...v].sort()]));

/* ── informe ── */
console.log('Áreas (px²/artículo ideal =', Math.round(unit) + '):');
for (const id of [...ids, 'tc', 'reforma']) {
  const arts = ARTS[id] || ISLANDS[id].arts;
  console.log(`  ${id.padEnd(12)} arts=${String(arts).padStart(2)}  área=${String(cellArea[id]).padStart(7)}  ratio=${(cellArea[id] / arts / unit).toFixed(2)}`);
}
console.log('Adyacencias:');
for (const [k, v] of Object.entries(adj)) console.log(`  ${k}: ${v.join(', ')}`);

/* ── salida ── */
const out = `/* Generado por gen-map.js — continente "Constitucia" (Voronoi ponderado por artículos) */
const MAP = ${JSON.stringify({ view: [W, H], land, centers, areas: cellArea, adj, seaRoutes: SEA_ROUTES }, null, 0)};
`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'map-data.js'), out);

/* preview SVG para inspección visual */
const colors = { preliminar: '#e3a93f', dignidad: '#35b5aa', derechos: '#2e9e64', deberes: '#7fb241', rectores: '#a8b03a', garantias: '#2e86ab', corona: '#a06bd8', cortes: '#4d7fd6', relaciones: '#5f9ee0', gobierno: '#e0703c', judicial: '#c9503c', tc: '#c43a6e', economia: '#a67c2e', territorial: '#56a05f', reforma: '#8a93a8' };
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#14202e"/>`;
for (const [a, b] of SEA_ROUTES) svg += `<line x1="${centers[a][0]}" y1="${centers[a][1]}" x2="${centers[b][0]}" y2="${centers[b][1]}" stroke="#5a7a9a" stroke-width="3" stroke-dasharray="6 8"/>`;
for (const [id, d] of Object.entries(land)) svg += `<path d="${d}" fill="${colors[id]}" stroke="#0d1520" stroke-width="2.5" fill-opacity="0.85"/>`;
for (const [id, c] of Object.entries(centers)) svg += `<text x="${c[0]}" y="${c[1]}" font-size="15" font-weight="bold" fill="#fff" text-anchor="middle" font-family="sans-serif">${id}</text>`;
svg += '</svg>';
fs.writeFileSync(path.join(__dirname, 'preview.svg'), svg);
console.log('✓ map-data.js y preview.svg generados');
