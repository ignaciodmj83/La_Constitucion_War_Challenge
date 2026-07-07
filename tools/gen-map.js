/* =========================================================================
   Generador del mundo "Constitucia" (2 niveles).
   - Nivel 1: cada título es un continente; si tiene capítulos, un archipiélago
     cuyas islas son los capítulos.
   - Nivel 2: cada landmass se subdivide en un TERRITORIO por artículo (169).
   Produce js/map-data.js con: por artículo {path, center, titulo, island},
   por título {color, name, theme, islands}, adyacencias y rutas marítimas.
   Uso: npm run map
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { TITULOS } = require('../js/hierarchy.js');

const W = 2000, H = 1300, STEP = 3;
const U = 1650;                 // px² por artículo (área objetivo)
const nx = Math.floor(W / STEP), ny = Math.floor(H / STEP);
const cx = (i) => i * STEP + STEP / 2;
const cy = (j) => j * STEP + STEP / 2;

/* Centros de cada título en el mundo. Los archipiélagos reparten sus islas
   alrededor del centro automáticamente. */
const POS = {
  preliminar: [330, 340],
  t1:  [370, 880],
  t2:  [660, 150],
  t3:  [1140, 330],
  t4:  [1560, 250],
  t5:  [1180, 650],
  t6:  [1580, 760],
  t7:  [830, 560],
  t8:  [820, 1050],
  t9:  [1820, 480],
  t10: [1780, 1080],
};

/* ── utilidades ── */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function artsOf(range) { const [a, b] = range; const r = []; for (let n = a; n <= b; n++) r.push(n); return r; }

function blobPolygon(ccx, ccy, r, seed, squash = 1) {
  const rnd = mulberry(seed);
  const n = 22, pts = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const jr = 0.82 + rnd() * 0.36;
    pts.push([ccx + Math.cos(ang) * r * jr, ccy + Math.sin(ang) * r * jr * squash]);
  }
  return pts;
}
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ── rejilla global de etiquetas (art number) ── */
const label = new Int32Array(nx * ny).fill(-1);     // -1 = mar
const islandOf = {};
const tituloOf = {};
const islandMeta = {};
const tituloMeta = {};

function layoutIslands(t) {
  const center = POS[t.id];
  const isl = t.islands.map((is) => {
    const arts = artsOf(is.arts);
    const area = arts.length * U;
    const r = Math.sqrt(area / Math.PI) * 1.08;
    return { ...is, arts, r, area };
  }).sort((a, b) => b.r - a.r);

  const placed = [];
  isl.forEach((is, idx) => {
    let pos;
    if (idx === 0) pos = center.slice();
    else {
      let ang = idx * 2.399, dist = isl[0].r + is.r + 26;
      for (let tries = 0; tries < 40; tries++) {
        pos = [center[0] + Math.cos(ang) * dist, center[1] + Math.sin(ang) * dist];
        const clash = placed.some((p) => Math.hypot(p.pos[0] - pos[0], p.pos[1] - pos[1]) < p.r + is.r + 16);
        if (!clash) break;
        ang += 0.6; dist += 10;
      }
    }
    placed.push({ ...is, pos });
  });
  return placed;
}

function rasterizeIsland(is, tituloId, seedBase) {
  const poly = blobPolygon(is.pos[0], is.pos[1], is.r, seedBase, 0.9);
  const cells = [];
  const i0 = Math.max(0, Math.floor((is.pos[0] - is.r * 1.4) / STEP));
  const i1 = Math.min(nx - 1, Math.ceil((is.pos[0] + is.r * 1.4) / STEP));
  const j0 = Math.max(0, Math.floor((is.pos[1] - is.r * 1.4) / STEP));
  const j1 = Math.min(ny - 1, Math.ceil((is.pos[1] + is.r * 1.4) / STEP));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (label[j * nx + i] !== -1) continue;
    if (inPoly(cx(i), cy(j), poly)) cells.push([i, j]);
  }
  const arts = is.arts;
  if (arts.length === 1) {
    for (const [i, j] of cells) label[j * nx + i] = arts[0];
  } else {
    const rnd = mulberry(seedBase * 131 + 7);
    let seeds = arts.map(() => {
      const c = cells[Math.floor(rnd() * cells.length)];
      return [cx(c[0]), cy(c[1])];
    });
    const assign = new Array(cells.length).fill(0);
    for (let it = 0; it < 12; it++) {
      for (let c = 0; c < cells.length; c++) {
        const x = cx(cells[c][0]), y = cy(cells[c][1]);
        let best = 0, bd = Infinity;
        for (let s = 0; s < seeds.length; s++) {
          const d = (x - seeds[s][0]) ** 2 + (y - seeds[s][1]) ** 2;
          if (d < bd) { bd = d; best = s; }
        }
        assign[c] = best;
      }
      const sx = seeds.map(() => 0), sy = seeds.map(() => 0), sn = seeds.map(() => 0);
      for (let c = 0; c < cells.length; c++) { const k = assign[c]; sx[k] += cx(cells[c][0]); sy[k] += cy(cells[c][1]); sn[k]++; }
      for (let s = 0; s < seeds.length; s++) if (sn[s]) seeds[s] = [sx[s] / sn[s], sy[s] / sn[s]];
    }
    for (let c = 0; c < cells.length; c++) label[cells[c][1] * nx + cells[c][0]] = arts[assign[c]];
  }
  islandMeta[is.id] = { name: is.name, tituloId, center: is.pos.map(Math.round), arts };
  for (const n of arts) { islandOf[n] = is.id; tituloOf[n] = tituloId; }
}

function fixArtFragments() {
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    const seen = new Int32Array(nx * ny).fill(-1);
    const compByArt = {};
    for (let idx = 0; idx < nx * ny; idx++) {
      const a = label[idx]; if (a < 0 || seen[idx] >= 0) continue;
      const comp = [idx]; seen[idx] = 1;
      for (let p = 0; p < comp.length; p++) {
        const c = comp[p], ci = c % nx, cj = (c / nx) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const nidx = nj * nx + ni;
          if (label[nidx] === a && seen[nidx] < 0) { seen[nidx] = 1; comp.push(nidx); }
        }
      }
      (compByArt[a] = compByArt[a] || []).push(comp);
    }
    for (const a of Object.keys(compByArt)) {
      const comps = compByArt[a]; if (comps.length <= 1) continue;
      comps.sort((x, y) => y.length - x.length);
      for (let c = 1; c < comps.length; c++) {
        for (const idx of comps[c]) {
          const ci = idx % nx, cj = (idx / nx) | 0; const votes = {};
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ni = ci + di, nj = cj + dj;
            if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
            const l = label[nj * nx + ni];
            if (l >= 0 && String(l) !== a) votes[l] = (votes[l] || 0) + 1;
          }
          const best = Object.entries(votes).sort((p, q) => q[1] - p[1])[0];
          if (best) { label[idx] = Number(best[0]); changed = true; }
        }
      }
    }
    if (!changed) break;
  }
}

function contour(n) {
  const val = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny && label[j * nx + i] === n) ? 1 : 0;
  const segs = new Map();
  const key = (p) => `${p[0]},${p[1]}`;
  const add = (a, b) => { const k = key(a); if (!segs.has(k)) segs.set(k, []); segs.get(k).push(b); };
  let mi = nx, ma = -1, mj = ny, mb = -1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (label[j * nx + i] === n) {
    if (i < mi) mi = i; if (i > ma) ma = i; if (j < mj) mj = j; if (j > mb) mb = j;
  }
  if (ma < 0) return [];
  for (let j = mj - 2; j <= mb + 1; j++) for (let i = mi - 2; i <= ma + 1; i++) {
    const tl = val(i, j), tr = val(i + 1, j), bl = val(i, j + 1), br = val(i + 1, j + 1);
    const c = tl * 8 + tr * 4 + br * 2 + bl;
    if (c === 0 || c === 15) continue;
    const x = cx(i), y = cy(j);
    const T = [x + STEP / 2, y], R = [x + STEP, y + STEP / 2], B = [x + STEP / 2, y + STEP], L = [x, y + STEP / 2];
    const cases = { 1: [[B, L]], 2: [[R, B]], 3: [[R, L]], 4: [[T, R]], 5: [[T, R], [B, L]], 6: [[T, B]], 7: [[T, L]], 8: [[L, T]], 9: [[B, T]], 10: [[L, T], [R, B]], 11: [[R, T]], 12: [[L, R]], 13: [[B, R]], 14: [[L, B]] };
    for (const [a, b] of cases[c]) add(a, b);
  }
  const loops = []; const used = new Set();
  for (const [start] of segs) {
    if (used.has(start)) continue;
    let cur = start.split(',').map(Number); const loop = [cur];
    while (true) {
      const k = key(cur); const nxs = segs.get(k);
      if (!nxs || !nxs.length) break;
      const nxt = nxs.shift(); used.add(k); cur = nxt;
      if (key(cur) === start) break; loop.push(cur);
      if (loop.length > 60000) break;
    }
    if (loop.length > 3) loops.push(loop);
  }
  loops.sort((a, b) => b.length - a.length);
  return loops[0] || [];
}
function dp(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let dm = 0, im = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > dm) { dm = d; im = i; }
    }
    if (dm > tol) { keep[im] = 1; st.push([a, im], [im, b]); }
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
const toPath = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + 'Z';

/* ── generar ── */
let seedCounter = 1;
for (const t of TITULOS) {
  tituloMeta[t.id] = { name: t.name, theme: t.theme, color: t.color, roman: t.roman, islands: [] };
  const placed = layoutIslands(t);
  for (const is of placed) { rasterizeIsland(is, t.id, seedCounter++); tituloMeta[t.id].islands.push(is.id); }
}
fixArtFragments();

const artPath = {}, artCenter = {};
for (let n = 1; n <= 169; n++) {
  let pts = contour(n);
  if (!pts.length) { console.error('¡Artículo sin celdas!', n); continue; }
  pts = dp(pts, 1.6); pts = chaikin(chaikin(pts)); pts = dp(pts, 0.7);
  artPath[n] = toPath(pts);
  let sx = 0, sy = 0, c = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (label[j * nx + i] === n) { sx += cx(i); sy += cy(j); c++; }
  artCenter[n] = [Math.round(sx / c), Math.round(sy / c)];
}

const adj = {}; for (let n = 1; n <= 169; n++) adj[n] = new Set();
for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
  const a = label[j * nx + i]; if (a < 0) continue;
  for (const [di, dj] of [[1, 0], [0, 1]]) {
    const ni = i + di, nj = j + dj; if (ni >= nx || nj >= ny) continue;
    const b = label[nj * nx + ni];
    if (b >= 0 && b !== a) { adj[a].add(b); adj[b].add(a); }
  }
}

const seaRoutes = [];
function nearestPair(artsA, artsB) {
  let best = null, bd = Infinity;
  for (const a of artsA) for (const b of artsB) {
    const d = (artCenter[a][0] - artCenter[b][0]) ** 2 + (artCenter[a][1] - artCenter[b][1]) ** 2;
    if (d < bd) { bd = d; best = [a, b]; }
  }
  return best;
}
function addSea(a, b) { adj[a].add(b); adj[b].add(a); seaRoutes.push([a, b]); }

for (const t of TITULOS) {
  if (t.islands.length <= 1) continue;
  const islands = t.islands.map((is) => ({ id: is.id, arts: islandMeta[is.id].arts }));
  const connected = [islands[0]]; const pending = islands.slice(1);
  while (pending.length) {
    let bi = 0, bpair = null, bd = Infinity;
    for (let p = 0; p < pending.length; p++) for (const c of connected) {
      const pair = nearestPair(pending[p].arts, c.arts);
      const d = (artCenter[pair[0]][0] - artCenter[pair[1]][0]) ** 2 + (artCenter[pair[0]][1] - artCenter[pair[1]][1]) ** 2;
      if (d < bd) { bd = d; bpair = pair; bi = p; }
    }
    addSea(bpair[0], bpair[1]); connected.push(pending[bi]); pending.splice(bi, 1);
  }
}
function reachableFrom(start) {
  const seen = new Set([start]); const st = [start];
  while (st.length) { const c = st.pop(); for (const nb of adj[c]) if (!seen.has(nb)) { seen.add(nb); st.push(nb); } }
  return seen;
}
const artsByTitulo = {};
for (const t of TITULOS) artsByTitulo[t.id] = t.islands.flatMap((is) => islandMeta[is.id].arts);
let guard = 0;
while (guard++ < 30) {
  const reach = reachableFrom(1);
  if (reach.size === 169) break;
  let bpair = null, bd = Infinity;
  const reachArts = [...reach];
  for (const t of TITULOS) {
    const outside = artsByTitulo[t.id].filter((n) => !reach.has(n));
    if (outside.length !== artsByTitulo[t.id].length) continue; // solo títulos totalmente fuera
    const pair = nearestPair(reachArts, outside);
    const d = (artCenter[pair[0]][0] - artCenter[pair[1]][0]) ** 2 + (artCenter[pair[0]][1] - artCenter[pair[1]][1]) ** 2;
    if (d < bd) { bd = d; bpair = pair; }
  }
  if (!bpair) break;
  addSea(bpair[0], bpair[1]);
}

const reach = reachableFrom(1);
console.log('Artículos:', Object.keys(artPath).length, '| conexos desde art.1:', reach.size, '/169');
console.log('Rutas marítimas:', seaRoutes.length);
for (const t of TITULOS) {
  const n = artsByTitulo[t.id].length;
  console.log(`  ${(t.roman || 'Prel.').padEnd(5)} ${t.name.slice(0, 26).padEnd(26)} arts=${String(n).padStart(2)} islas=${t.islands.length}`);
}

const adjOut = {}; for (let n = 1; n <= 169; n++) adjOut[n] = [...adj[n]].sort((a, b) => a - b);
const out = `/* Generado por tools/gen-map.js — mundo Constitucia (169 territorios) */
const MAP = ${JSON.stringify({ view: [W, H], art: { path: artPath, center: artCenter, island: islandOf, titulo: tituloOf }, islands: islandMeta, titulos: tituloMeta, adj: adjOut, seaRoutes }, null, 0)};
if (typeof module !== 'undefined') module.exports = { MAP };
`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'map-data.js'), out);

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#0d1f2e"/>`;
for (const [a, b] of seaRoutes) svg += `<line x1="${artCenter[a][0]}" y1="${artCenter[a][1]}" x2="${artCenter[b][0]}" y2="${artCenter[b][1]}" stroke="#3a5a72" stroke-width="2" stroke-dasharray="4 6"/>`;
for (let n = 1; n <= 169; n++) {
  if (!artPath[n]) continue;
  const col = tituloMeta[tituloOf[n]].color;
  svg += `<path d="${artPath[n]}" fill="${col}" fill-opacity="0.9" stroke="#0d1f2e" stroke-width="1.2"/>`;
  svg += `<text x="${artCenter[n][0]}" y="${artCenter[n][1] + 4}" font-size="11" fill="#fff" text-anchor="middle" font-family="sans-serif">${n}</text>`;
}
svg += '</svg>';
fs.writeFileSync(path.join(__dirname, 'preview.svg'), svg);
console.log('✓ map-data.js y preview.svg generados');
