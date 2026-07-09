/* =========================================================================
   Generador del mundo "Constitucia" — DOS CONTINENTES al estilo Poniente/Essos:
     - "home" (Poniente): continente ALTO y estrecho a la izquierda (N→S).
       Preliminar + Título I + Título II. Se empieza en el norte.
     - "far" (Essos): continente ANCHO y horizontal a la derecha (O→E).
       Títulos III a VIII. Se llega cruzando el mar.

   Reinos divididos en zonas (SIN ríos):
   - Cada título es una región contigua del continente (Voronoi ponderado,
     fronteras sinuosas por domain warp).
   - Los títulos con capítulos muestran sus CAPÍTULOS PEQUEÑOS (≤ SAT_MAX
     artículos) como ISLAS del mismo color frente a su costa. Los capítulos
     grandes forman el cuerpo principal del reino. Así se ve el reino dividido
     en varias zonas.
   - Los Títulos IX y X son islas propias al este de Essos.
   - Cada capítulo se subdivide en un TERRITORIO por artículo.

   Produce js/map-data.js. Uso: npm run map
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { TITULOS } = require('../js/hierarchy.js');

const W = 2500, H = 1900, STEP = 3;
const nx = Math.floor(W / STEP), ny = Math.floor(H / STEP);
const cx = (i) => i * STEP + STEP / 2;
const cy = (j) => j * STEP + STEP / 2;
const SAT_MAX = 5; // capítulos con ≤ 5 artículos van como islas del reino

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
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function chaikin(pts, closed = true) {
  const out = []; const n = pts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    out.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]]);
    out.push([0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
  }
  if (!closed) out.unshift(pts[0]), out.push(pts[n - 1]);
  return out;
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
const toPath = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + 'Z';
function bboxOfMask(mask) {
  let i0 = nx, i1 = -1, j0 = ny, j1 = -1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!mask[j * nx + i]) continue;
    if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
  }
  return { i0, i1, j0, j1 };
}

/* ── campo de ruido → fronteras sinuosas (domain warp) ── */
function makeValueNoise(seed, gx, gy) {
  const rnd = mulberry(seed);
  const grid = [];
  for (let j = 0; j <= gy; j++) { const row = []; for (let i = 0; i <= gx; i++) row.push(rnd() * 2 - 1); grid.push(row); }
  return (x, y) => {
    let fx = x / W * gx, fy = y / H * gy;
    if (fx < 0) fx = 0; if (fx > gx) fx = gx; if (fy < 0) fy = 0; if (fy > gy) fy = gy;
    const i0 = Math.floor(fx), j0 = Math.floor(fy);
    const i1 = Math.min(gx, i0 + 1), j1 = Math.min(gy, j0 + 1);
    const tx = fx - i0, ty = fy - j0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = grid[j0][i0], b = grid[j0][i1], c = grid[j1][i0], d = grid[j1][i1];
    const top = a + (b - a) * sx, bot = c + (d - c) * sx;
    return top + (bot - top) * sy;
  };
}
const GX = Math.round(W / 105), GY = Math.round(H / 105);
const noiseX = makeValueNoise(717, GX, GY);
const noiseY = makeValueNoise(919, GX, GY);
const WARP = 19;
const warpX = (x, y) => x + noiseX(x, y) * WARP;
const warpY = (x, y) => y + noiseY(x, y) * WARP;

/* ═══════════════ 1. Siluetas de los continentes ═══════════════ */
function makeInterp(profile) {
  return (t) => {
    for (let i = 0; i < profile.length - 1; i++) {
      const [t0, hw0, sw0] = profile[i], [t1, hw1, sw1] = profile[i + 1];
      if (t >= t0 && t <= t1) {
        const f = (t - t0) / (t1 - t0 || 1);
        const s = f * f * (3 - 2 * f);
        return [hw0 + (hw1 - hw0) * s, sw0 + (sw1 - sw0) * s];
      }
    }
    return [profile[profile.length - 1][1], profile[profile.length - 1][2]];
  };
}
const PROFILE_HOME = [
  [0.00, 0.28, 0.00], [0.05, 0.66, 0.00], [0.13, 0.95, 0.06], [0.24, 0.85, 0.10],
  [0.33, 0.40, 0.04], [0.40, 0.48, 0.00], [0.52, 0.92, -0.06], [0.66, 1.00, 0.04],
  [0.78, 0.75, -0.04], [0.90, 0.42, 0.02], [0.97, 0.17, 0.00], [1.00, 0.05, 0.00],
];
const PROFILE_FAR = [
  [0.00, 0.52, 0.10], [0.07, 0.86, -0.04], [0.16, 0.70, -0.15], [0.26, 1.00, -0.02],
  [0.36, 0.92, 0.07], [0.46, 1.00, 0.00], [0.58, 0.86, 0.09], [0.70, 0.72, 0.00],
  [0.80, 0.80, -0.07], [0.90, 0.46, 0.00], [0.97, 0.18, 0.03], [1.00, 0.05, 0.00],
];
const HOME_CFG = { id: 'home', base: [500, 30], axis: [0, 1840], thick: 300, profile: PROFILE_HOME, seed: 20260707, jitter: 6, coastAmp: 0.32, swayAmp: 0.13 };
const FAR_CFG = { id: 'far', base: [1250, 985], axis: [1010, 0], thick: 600, profile: PROFILE_FAR, seed: 20260808, jitter: 7, coastAmp: 0.34, swayAmp: 0.15 };

/* ruido 1D suave (para costas orgánicas). */
function make1DNoise(seed, cells) {
  const rnd = mulberry(seed); const g = [];
  for (let i = 0; i <= cells; i++) g.push(rnd() * 2 - 1);
  return (t) => {
    let x = (t < 0 ? 0 : t > 1 ? 1 : t) * cells;
    const i0 = Math.floor(x), i1 = Math.min(cells, i0 + 1), f = x - i0, s = f * f * (3 - 2 * f);
    return g[i0] + (g[i1] - g[i0]) * s;
  };
}
/* fBm 1D: varias octavas → costa con cabos y bahías a distintas escalas. */
function coastFn(seed) {
  const oct = [{ n: make1DNoise(seed, 3), a: 1 }, { n: make1DNoise(seed + 11, 7), a: 0.52 }, { n: make1DNoise(seed + 23, 16), a: 0.27 }, { n: make1DNoise(seed + 37, 34), a: 0.14 }];
  const norm = oct.reduce((s, o) => s + o.a, 0);
  return (t) => oct.reduce((s, o) => s + o.a * o.n(t), 0) / norm;
}

function buildContinent(cfg) {
  const interp = makeInterp(cfg.profile);
  const rnd = mulberry(cfg.seed);
  const L = Math.hypot(cfg.axis[0], cfg.axis[1]);
  const dir = [cfg.axis[0] / L, cfg.axis[1] / L];
  const perp = [-dir[1], dir[0]];
  const steps = 150;
  const cL = coastFn(cfg.seed + 101), cR = coastFn(cfg.seed + 202), cS = coastFn(cfg.seed + 303);
  const left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [hwF, swF] = interp(t);
    // ventana que apaga el ruido en los extremos → cabos afilados y costa
    // rugosa e independiente a cada lado en el centro.
    const win = Math.pow(Math.sin(Math.PI * t), 0.6);
    const spineOff = (swF + cfg.swayAmp * win * cS(t)) * cfg.thick;
    const cxp = cfg.base[0] + cfg.axis[0] * t + perp[0] * spineOff;
    const cyp = cfg.base[1] + cfg.axis[1] * t + perp[1] * spineOff;
    const minOff = 0.05 * cfg.thick;
    let lo = (hwF + cfg.coastAmp * win * cL(t)) * cfg.thick;
    let ro = (hwF + cfg.coastAmp * win * cR(t)) * cfg.thick;
    if (lo < minOff) lo = minOff; if (ro < minOff) ro = minOff;
    const jl = (rnd() - 0.5) * cfg.jitter, jr = (rnd() - 0.5) * cfg.jitter;
    left.push([cxp + perp[0] * (lo + jl), cyp + perp[1] * (lo + jl)]);
    right.push([cxp - perp[0] * (ro + jr), cyp - perp[1] * (ro + jr)]);
  }
  let poly = left.concat(right.reverse());
  poly = chaikin(poly); poly = dp(poly, 1.0);
  return poly;
}
function rasterizePoly(poly) {
  const mask = new Uint8Array(nx * ny); let count = 0;
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (const [x, y] of poly) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const i0 = Math.max(0, Math.floor(minX / STEP)), i1 = Math.min(nx - 1, Math.ceil(maxX / STEP));
  const j0 = Math.max(0, Math.floor(minY / STEP)), j1 = Math.min(ny - 1, Math.ceil(maxY / STEP));
  for (let j = j0; j <= j1; j++) { const y = cy(j); for (let i = i0; i <= i1; i++) { if (inPoly(cx(i), y, poly)) { mask[j * nx + i] = 1; count++; } } }
  return { mask, count };
}
const HOME_POLY = buildContinent(HOME_CFG);
const FAR_POLY = buildContinent(FAR_CFG);
const HOME = rasterizePoly(HOME_POLY);
const FAR = rasterizePoly(FAR_POLY);
const onLand = new Uint8Array(nx * ny);
for (let idx = 0; idx < nx * ny; idx++) onLand[idx] = (HOME.mask[idx] || FAR.mask[idx]) ? 1 : 0;

function seederFor(cfg) {
  const L = Math.hypot(cfg.axis[0], cfg.axis[1]);
  const dir = [cfg.axis[0] / L, cfg.axis[1] / L];
  const perp = [-dir[1], dir[0]];
  return (mainFrac, crossFrac) => [
    cfg.base[0] + cfg.axis[0] * mainFrac + perp[0] * crossFrac * cfg.thick,
    cfg.base[1] + cfg.axis[1] * mainFrac + perp[1] * crossFrac * cfg.thick,
  ];
}
const seedHome = seederFor(HOME_CFG);
const seedFar = seederFor(FAR_CFG);
const SEEDS = {
  preliminar: seedHome(0.09, 0.00), t1: seedHome(0.50, -0.05), t2: seedHome(0.90, 0.05),
  t3: seedFar(0.10, 0.05), t4: seedFar(0.30, -0.42), t5: seedFar(0.32, 0.45),
  t6: seedFar(0.52, -0.28), t7: seedFar(0.58, 0.46), t8: seedFar(0.82, -0.02),
};

/* ═══════════════ clasificación de capítulos: mainland vs isla ═══════════════ */
const capMeta = {};   // capId -> { name, tituloId, arts:[...] }
const chapList = [];  // todos los capítulos con su clase
for (const t of TITULOS) {
  const chs = t.islands.map((is) => ({ id: is.id, name: is.name, tituloId: t.id, arts: artsOf(is.arts) }));
  for (const c of chs) capMeta[c.id] = { name: c.name, tituloId: t.id, arts: c.arts };
  if (t.island) { chs.forEach((c) => { c.cls = 'islandTitulo'; chapList.push(c); }); continue; }
  const sorted = chs.slice().sort((a, b) => b.arts.length - a.arts.length);
  const biggest = sorted[0].id;
  for (const c of chs) { c.cls = (c.id !== biggest && c.arts.length <= SAT_MAX) ? 'satellite' : 'mainland'; chapList.push(c); }
}
const chapIndex = {}; chapList.forEach((c, k) => { chapIndex[c.id] = k; });
function tituloOfCap(capId) { return capMeta[capId].tituloId; }

/* títulos por continente y sus capítulos mainland */
const MAINLAND_TITULOS = TITULOS.filter((t) => !t.island);
const HOME_TITULOS = MAINLAND_TITULOS.filter((t) => t.continent === 'home');
const FAR_TITULOS = MAINLAND_TITULOS.filter((t) => t.continent === 'far');
function mainlandArtsOfTitulo(t) { return chapList.filter((c) => c.tituloId === t.id && c.cls === 'mainland').reduce((s, c) => s + c.arts.length, 0); }

/* ═══════════════ 2. Regiones de título (Voronoi ponderado + warp) ═══════════════ */
const tituloLabel = new Int16Array(nx * ny).fill(-1); // índice en MAINLAND_TITULOS
const mtIndex = {}; MAINLAND_TITULOS.forEach((t, k) => { mtIndex[t.id] = k; });
function assignTitulos(mask, subset) {
  const ids = subset.map((t) => t.id);
  const target = {}; let total = 0;
  for (const t of subset) { const n = mainlandArtsOfTitulo(t); target[t.id] = n; total += n; }
  const { i0, i1, j0, j1 } = bboxOfMask(mask);
  let cells = 0; for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (mask[j * nx + i]) cells++;
  const tgt = ids.map((id) => (target[id] / total) * cells);
  const pos = ids.map((id) => SEEDS[id]);
  const w = ids.map(() => 0);
  function pass() {
    const areas = ids.map(() => 0);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const idx = j * nx + i; if (!mask[idx]) continue;
      const x = warpX(cx(i), cy(j)), y = warpY(cx(i), cy(j));
      let best = -1, bd = Infinity;
      for (let k = 0; k < ids.length; k++) { const d = (x - pos[k][0]) ** 2 + (y - pos[k][1]) ** 2 - w[k]; if (d < bd) { bd = d; best = k; } }
      tituloLabel[idx] = mtIndex[ids[best]]; areas[best]++;
    }
    return areas;
  }
  for (let it = 0; it < 140; it++) { const areas = pass(); for (let k = 0; k < ids.length; k++) w[k] += 850 * ((tgt[k] - areas[k]) / tgt[k]); }
  pass();
}
assignTitulos(HOME.mask, HOME_TITULOS);
assignTitulos(FAR.mask, FAR_TITULOS);

function fixFragments(labelArr, valid) {
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    const seen = new Int32Array(nx * ny).fill(-1); const comps = {};
    for (let idx = 0; idx < nx * ny; idx++) {
      if (!valid(idx)) continue; const a = labelArr[idx]; if (a < 0 || seen[idx] >= 0) continue;
      const comp = [idx]; seen[idx] = 1;
      for (let p = 0; p < comp.length; p++) {
        const c = comp[p], ci = c % nx, cj = (c / nx) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const nidx = nj * nx + ni; if (!valid(nidx)) continue;
          if (labelArr[nidx] === a && seen[nidx] < 0) { seen[nidx] = 1; comp.push(nidx); }
        }
      }
      (comps[a] = comps[a] || []).push(comp);
    }
    for (const a of Object.keys(comps)) {
      const cs = comps[a]; if (cs.length <= 1) continue; cs.sort((x, y) => y.length - x.length);
      for (let c = 1; c < cs.length; c++) for (const idx of cs[c]) {
        const ci = idx % nx, cj = (idx / nx) | 0; const votes = {};
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const nidx = nj * nx + ni; if (!valid(nidx)) continue;
          const l = labelArr[nidx]; if (l >= 0 && String(l) !== a) votes[l] = (votes[l] || 0) + 1;
        }
        const best = Object.entries(votes).sort((p, q) => q[1] - p[1])[0];
        if (best) { labelArr[idx] = Number(best[0]); changed = true; }
      }
    }
    if (!changed) break;
  }
}
fixFragments(tituloLabel, (idx) => onLand[idx] === 1);

/* ═══════════════ 3a. capítulos mainland dentro de cada título ═══════════════ */
const chapLabel = new Int32Array(nx * ny).fill(-1); // índice en chapList
function subdivideMainland(t) {
  const tIdx = mtIndex[t.id];
  const chaps = chapList.filter((c) => c.tituloId === t.id && c.cls === 'mainland');
  const cells = []; for (let idx = 0; idx < nx * ny; idx++) if (onLand[idx] && tituloLabel[idx] === tIdx) cells.push(idx);
  if (chaps.length === 1) { for (const idx of cells) chapLabel[idx] = chapIndex[chaps[0].id]; return; }
  // Voronoi ponderado entre capítulos mainland, semillas repartidas en la región
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (const idx of cells) { const i = idx % nx, j = (idx / nx) | 0; const x = cx(i), y = cy(j); if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const total = chaps.reduce((s, c) => s + c.arts.length, 0);
  const pos = chaps.map((c, k) => [minX + (maxX - minX) * ((k + 0.5) / chaps.length), (minY + maxY) / 2]);
  const w = chaps.map(() => 0);
  const target = chaps.map((c) => (c.arts.length / total) * cells.length);
  function pass() {
    const areas = chaps.map(() => 0); const assign = new Int32Array(cells.length);
    for (let c = 0; c < cells.length; c++) {
      const i = cells[c] % nx, j = (cells[c] / nx) | 0; const x = warpX(cx(i), cy(j)), y = warpY(cx(i), cy(j));
      let best = 0, bd = Infinity;
      for (let k = 0; k < chaps.length; k++) { const d = (x - pos[k][0]) ** 2 + (y - pos[k][1]) ** 2 - w[k]; if (d < bd) { bd = d; best = k; } }
      assign[c] = best; areas[best]++;
    }
    return { areas, assign };
  }
  let last;
  for (let it = 0; it < 60; it++) { last = pass(); for (let k = 0; k < chaps.length; k++) w[k] += 500 * ((target[k] - last.areas[k]) / target[k]); }
  last = pass();
  for (let c = 0; c < cells.length; c++) chapLabel[cells[c]] = chapIndex[chaps[last.assign[c]].id];
}
for (const t of MAINLAND_TITULOS) subdivideMainland(t);
fixFragments(chapLabel, (idx) => chapLabel[idx] >= 0);

/* ═══════════════ 3b. islas: capítulos satélite (color del reino) + Títulos IX/X ═══════════════ */
const COAST_GAP_CELLS = 13;
function dilate(src, times) {
  let cur = src;
  for (let r = 0; r < times; r++) {
    const next = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const idx = j * nx + i; if (cur[idx]) { next[idx] = 1; continue; }
      let near = false;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni >= 0 && nj >= 0 && ni < nx && nj < ny && cur[nj * nx + ni]) { near = true; break; } }
      next[idx] = near ? 1 : 0;
    }
    cur = next;
  }
  return cur;
}
const occupied = Uint8Array.from(dilate(onLand, COAST_GAP_CELLS)); // sitios prohibidos para islas
const TOTAL_MAINLAND_ARTS = MAINLAND_TITULOS.reduce((s, t) => s + mainlandArtsOfTitulo(t), 0);
const UNIT = (HOME.count + FAR.count) * STEP * STEP / TOTAL_MAINLAND_ARTS;

function blobPolygon(ccx, ccy, r, seed) {
  const rnd = mulberry(seed); const n = 22, pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const jr = 0.80 + rnd() * 0.36; pts.push([ccx + Math.cos(a) * r * jr, ccy + Math.sin(a) * r * jr]); }
  return chaikin(pts);
}
function fits(ccx, ccy, r) {
  const rr = r * 1.28;
  const i0 = Math.floor((ccx - rr) / STEP), i1 = Math.ceil((ccx + rr) / STEP);
  const j0 = Math.floor((ccy - rr) / STEP), j1 = Math.ceil((ccy + rr) / STEP);
  if (i0 < 1 || j0 < 1 || i1 >= nx - 1 || j1 >= ny - 1) return false;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if ((cx(i) - ccx) ** 2 + (cy(j) - ccy) ** 2 <= rr * rr && occupied[j * nx + i]) return false;
  }
  return true;
}
function placeBlob(anchor, r, seed) {
  if (fits(anchor[0], anchor[1], r)) return [anchor[0], anchor[1]];
  const rnd = mulberry(seed);
  for (let dist = STEP * 3; dist < 1600; dist += STEP * 3) {
    const a0 = rnd() * Math.PI * 2;
    for (let a = 0; a < 30; a++) {
      const ang = a0 + a * (Math.PI * 2 / 30);
      const c = [anchor[0] + Math.cos(ang) * dist, anchor[1] + Math.sin(ang) * dist];
      if (fits(c[0], c[1], r)) return c;
    }
  }
  return null;
}
const ISLAND_ANCHORS = { t9: [2320, 360], t10: [2360, 1520] }; // Títulos IX/X al este de Essos
const islandBlobs = chapList.filter((c) => c.cls === 'satellite' || c.cls === 'islandTitulo')
  .sort((a, b) => b.arts.length - a.arts.length);
for (const c of islandBlobs) {
  const r = Math.sqrt((c.arts.length * UNIT) / Math.PI) * 1.12;
  const anchor = c.cls === 'islandTitulo' ? ISLAND_ANCHORS[c.tituloId] : SEEDS[c.tituloId];
  const center = placeBlob(anchor, r, 4200 + chapIndex[c.id] * 131);
  if (!center) { console.error('¡Isla sin sitio!', c.id); continue; }
  const poly = blobPolygon(center[0], center[1], r, 9000 + chapIndex[c.id] * 77);
  const i0 = Math.max(0, Math.floor((center[0] - r * 1.4) / STEP)), i1 = Math.min(nx - 1, Math.ceil((center[0] + r * 1.4) / STEP));
  const j0 = Math.max(0, Math.floor((center[1] - r * 1.4) / STEP)), j1 = Math.min(ny - 1, Math.ceil((center[1] + r * 1.4) / STEP));
  let placed = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const idx = j * nx + i; if (occupied[idx] || onLand[idx]) continue;
    if (inPoly(cx(i), cy(j), poly)) { chapLabel[idx] = chapIndex[c.id]; placed++; }
  }
  if (!placed) { console.error('¡Isla sin celdas!', c.id); continue; }
  // marcar como ocupado (disco r + separación) para que las siguientes islas no se peguen
  const gr = r + COAST_GAP_CELLS * STEP;
  const gi0 = Math.max(0, Math.floor((center[0] - gr) / STEP)), gi1 = Math.min(nx - 1, Math.ceil((center[0] + gr) / STEP));
  const gj0 = Math.max(0, Math.floor((center[1] - gr) / STEP)), gj1 = Math.min(ny - 1, Math.ceil((center[1] + gr) / STEP));
  for (let j = gj0; j <= gj1; j++) for (let i = gi0; i <= gi1; i++) if ((cx(i) - center[0]) ** 2 + (cy(j) - center[1]) ** 2 <= gr * gr) occupied[j * nx + i] = 1;
}

/* ═══════════════ 4. Territorios (un artículo por celda-capítulo) + warp ═══════════════ */
const artLabel = new Int32Array(nx * ny).fill(-1);
let seedCounter = 1;
function rasterizeArticles(cap) {
  const arts = cap.arts; const ci = chapIndex[cap.id];
  const cells = []; for (let idx = 0; idx < nx * ny; idx++) if (chapLabel[idx] === ci) cells.push(idx);
  if (!cells.length) { console.error('¡Capítulo sin celdas!', cap.id); return; }
  if (arts.length === 1) { for (const idx of cells) artLabel[idx] = arts[0]; return; }
  const rnd = mulberry(seedCounter++ * 733 + 11);
  let seeds = arts.map(() => { const c = cells[Math.floor(rnd() * cells.length)]; return [cx(c % nx), cy((c / nx) | 0)]; });
  const assign = new Array(cells.length).fill(0);
  for (let it = 0; it < 12; it++) {
    for (let c = 0; c < cells.length; c++) {
      const i = cells[c] % nx, j = (cells[c] / nx) | 0; const x = warpX(cx(i), cy(j)), y = warpY(cx(i), cy(j));
      let best = 0, bd = Infinity;
      for (let s = 0; s < seeds.length; s++) { const d = (x - seeds[s][0]) ** 2 + (y - seeds[s][1]) ** 2; if (d < bd) { bd = d; best = s; } }
      assign[c] = best;
    }
    const sx = seeds.map(() => 0), sy = seeds.map(() => 0), sn = seeds.map(() => 0);
    for (let c = 0; c < cells.length; c++) { const k = assign[c]; const i = cells[c] % nx, j = (cells[c] / nx) | 0; sx[k] += cx(i); sy[k] += cy(j); sn[k]++; }
    for (let s = 0; s < seeds.length; s++) if (sn[s]) seeds[s] = [sx[s] / sn[s], sy[s] / sn[s]];
  }
  for (let c = 0; c < cells.length; c++) artLabel[cells[c]] = arts[assign[c]];
}
for (const c of chapList) rasterizeArticles(c);

function fixArtFragments() {
  for (let pass = 0; pass < 8; pass++) {
    let changed = false; const seen = new Int32Array(nx * ny).fill(-1); const comps = {};
    for (let idx = 0; idx < nx * ny; idx++) {
      const a = artLabel[idx]; if (a < 0 || seen[idx] >= 0) continue;
      const comp = [idx]; seen[idx] = 1;
      for (let p = 0; p < comp.length; p++) {
        const c = comp[p], ci = c % nx, cj = (c / nx) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const nidx = nj * nx + ni; if (artLabel[nidx] === a && seen[nidx] < 0) { seen[nidx] = 1; comp.push(nidx); }
        }
      }
      (comps[a] = comps[a] || []).push(comp);
    }
    for (const a of Object.keys(comps)) {
      const cs = comps[a]; if (cs.length <= 1) continue; cs.sort((x, y) => y.length - x.length);
      for (let c = 1; c < cs.length; c++) for (const idx of cs[c]) {
        const ci = idx % nx, cj = (idx / nx) | 0; const votes = {};
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const l = artLabel[nj * nx + ni]; if (l >= 0 && String(l) !== a) votes[l] = (votes[l] || 0) + 1;
        }
        const best = Object.entries(votes).sort((p, q) => q[1] - p[1])[0];
        if (best) { artLabel[idx] = Number(best[0]); changed = true; }
      }
    }
    if (!changed) break;
  }
}
fixArtFragments();

/* ═══════════════ marching squares ═══════════════ */
function contourFor(labelArr, val) {
  const at = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny && labelArr[j * nx + i] === val) ? 1 : 0;
  const segs = new Map(); const key = (p) => `${p[0]},${p[1]}`;
  const add = (a, b) => { const k = key(a); if (!segs.has(k)) segs.set(k, []); segs.get(k).push(b); };
  let mi = nx, ma = -1, mj = ny, mb = -1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (labelArr[j * nx + i] === val) { if (i < mi) mi = i; if (i > ma) ma = i; if (j < mj) mj = j; if (j > mb) mb = j; }
  if (ma < 0) return [];
  for (let j = mj - 2; j <= mb + 1; j++) for (let i = mi - 2; i <= ma + 1; i++) {
    const tl = at(i, j), tr = at(i + 1, j), bl = at(i, j + 1), br = at(i + 1, j + 1);
    const c = tl * 8 + tr * 4 + br * 2 + bl; if (c === 0 || c === 15) continue;
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
      const k = key(cur); const nxs = segs.get(k); if (!nxs || !nxs.length) break;
      const nxt = nxs.shift(); used.add(k); cur = nxt;
      if (key(cur) === start) break; loop.push(cur);
      if (loop.length > 60000) break;
    }
    if (loop.length > 3) loops.push(loop);
  }
  loops.sort((a, b) => b.length - a.length);
  return loops[0] || [];
}

const artPath = {}, artCenter = {};
for (let n = 1; n <= 169; n++) {
  let pts = contourFor(artLabel, n);
  if (!pts.length) { console.error('¡Artículo sin celdas!', n); continue; }
  pts = dp(pts, 1.2); pts = chaikin(chaikin(pts)); pts = dp(pts, 0.5);
  artPath[n] = toPath(pts);
  let sx = 0, sy = 0, c = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (artLabel[j * nx + i] === n) { sx += cx(i); sy += cy(j); c++; }
  artCenter[n] = [Math.round(sx / c), Math.round(sy / c)];
}

/* islandOf / tituloOf por artículo */
const islandOf = {}, tituloOf = {};
for (const c of chapList) for (const n of c.arts) { islandOf[n] = c.id; tituloOf[n] = c.tituloId; }

/* contorno de cada capítulo (para verlos dentro del reino). Solo en reinos con
   varios capítulos; los satélites ya son islas visualmente separadas, así que
   se dibuja el contorno de los capítulos del cuerpo principal. */
const chapterOutlines = [];
for (const c of chapList) {
  const t = TITULOS.find((x) => x.id === c.tituloId);
  if (t.islands.length <= 1) continue;
  if (c.cls !== 'mainland') continue;
  let pts = contourFor(chapLabel, chapIndex[c.id]);
  if (pts.length < 4) continue;
  pts = dp(pts, 1.4); pts = chaikin(chaikin(pts)); pts = dp(pts, 0.6);
  chapterOutlines.push({ tituloId: c.tituloId, capId: c.id, path: toPath(pts) });
}

/* ═══════════════ adyacencia terrestre ═══════════════ */
const adj = {}; for (let n = 1; n <= 169; n++) adj[n] = new Set();
for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
  const a = artLabel[j * nx + i]; if (a < 0) continue;
  for (const [di, dj] of [[1, 0], [0, 1]]) {
    const ni = i + di, nj = j + dj; if (ni >= nx || nj >= ny) continue;
    const b = artLabel[nj * nx + ni]; if (b >= 0 && b !== a) { adj[a].add(b); adj[b].add(a); }
  }
}

/* ═══════════════ rutas marítimas: cruce home↔far + islas de cada reino ═══════════════ */
const seaRoutes = [];
function nearestPair(a, b) { let best = null, bd = Infinity; for (const x of a) for (const y of b) { const d = (artCenter[x][0] - artCenter[y][0]) ** 2 + (artCenter[x][1] - artCenter[y][1]) ** 2; if (d < bd) { bd = d; best = [x, y]; } } return best; }
function addSea(a, b) { adj[a].add(b); adj[b].add(a); seaRoutes.push([a, b]); }
function reachableFrom(start) { const seen = new Set([start]); const st = [start]; while (st.length) { const c = st.pop(); for (const m of adj[c]) if (!seen.has(m)) { seen.add(m); st.push(m); } } return seen; }
const START_ART = TITULOS.find((t) => t.start).islands[0].arts[0];
function artsOfTituloMainland(tid) { const r = []; for (const c of chapList) if (c.tituloId === tid && c.cls === 'mainland') r.push(...c.arts); return r; }

// 1) cruce obligatorio home→far
{
  const reach = reachableFrom(START_ART);
  const farArts = []; for (const t of FAR_TITULOS) farArts.push(...artsOfTituloMainland(t.id));
  if (!farArts.some((n) => reach.has(n))) { const p = nearestPair([...reach], farArts); if (p) addSea(p[0], p[1]); }
}
// 2) cada isla-capítulo (satélite) se une a su propio reino
for (const c of chapList) {
  if (c.cls !== 'satellite') continue;
  const parentMain = artsOfTituloMainland(c.tituloId); if (!parentMain.length) continue;
  const already = reachableFrom(START_ART); if (c.arts.some((n) => already.has(n))) continue;
  const p = nearestPair(parentMain, c.arts); if (p) addSea(p[0], p[1]);
}
// 3) Títulos IX/X (islas propias) al conjunto alcanzable
for (const c of chapList) {
  if (c.cls !== 'islandTitulo') continue;
  const reach = reachableFrom(START_ART); if (c.arts.some((n) => reach.has(n))) continue;
  const p = nearestPair([...reach], c.arts); if (p) addSea(p[0], p[1]);
}
// 4) red de seguridad
let guard = 0;
while (guard++ < 30) {
  const reach = reachableFrom(START_ART); if (reach.size === 169) break;
  const outside = []; for (let n = 1; n <= 169; n++) if (!reach.has(n)) outside.push(n);
  const p = nearestPair([...reach], outside); if (!p) break; addSea(p[0], p[1]);
}

/* ═══════════════ centro de etiqueta del reino (cuerpo principal) ═══════════════ */
const tituloLabelCenter = {};
for (const t of TITULOS) {
  const main = t.island ? t.islands.flatMap((is) => artsOf(is.arts)) : artsOfTituloMainland(t.id);
  const arts = main.length ? main : t.islands.flatMap((is) => artsOf(is.arts));
  let sx = 0, sy = 0, c = 0; for (const n of arts) if (artCenter[n]) { sx += artCenter[n][0]; sy += artCenter[n][1]; c++; }
  tituloLabelCenter[t.id] = c ? [Math.round(sx / c), Math.round(sy / c)] : [0, 0];
}

/* ═══════════════ informe ═══════════════ */
const reachFinal = reachableFrom(START_ART);
console.log('Artículos:', Object.keys(artPath).length, '| conexos desde art.', START_ART, ':', reachFinal.size, '/169');
console.log('Home celdas=', HOME.count, '| Far celdas=', FAR.count, '| UNIT=', Math.round(UNIT));
const sats = chapList.filter((c) => c.cls === 'satellite').length, isl = chapList.filter((c) => c.cls === 'islandTitulo').length;
console.log('Islas-capítulo (satélites):', sats, '| Islas-título:', isl, '| rutas marítimas:', seaRoutes.length);
for (const t of TITULOS) {
  const cs = chapList.filter((c) => c.tituloId === t.id);
  const desc = cs.map((c) => `${c.cls === 'satellite' ? '🏝' : c.cls === 'islandTitulo' ? '🏝' : '▪'}${c.arts.length}`).join(' ');
  console.log(`  ${(t.roman || 'Prel.').padEnd(5)} ${t.name.slice(0, 24).padEnd(24)} ${desc}`);
}

/* ═══════════════ salida ═══════════════ */
const adjOut = {}; for (let n = 1; n <= 169; n++) adjOut[n] = [...adj[n]].sort((a, b) => a - b);
const islandsOut = {}; for (const [id, m] of Object.entries(capMeta)) islandsOut[id] = { name: m.name, tituloId: m.tituloId, center: artCenter[m.arts[Math.floor(m.arts.length / 2)]] || [0, 0], arts: m.arts };
const titulosOut = {}; for (const t of TITULOS) titulosOut[t.id] = { name: t.name, theme: t.theme, color: t.color, roman: t.roman, emblem: t.emblem || t.faction.unit, islands: t.islands.map((is) => is.id), continent: t.continent || null, labelCenter: tituloLabelCenter[t.id] };

const out = `/* Generado por tools/gen-map.js — mundo Constitucia (Poniente + Essos, reinos con islas, 169 territorios) */
const MAP = ${JSON.stringify({ view: [W, H], art: { path: artPath, center: artCenter, island: islandOf, titulo: tituloOf }, islands: islandsOut, titulos: titulosOut, adj: adjOut, seaRoutes, chapterBorders: [], chapterOutlines }, null, 0)};
if (typeof module !== 'undefined') module.exports = { MAP };
`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'map-data.js'), out);

/* preview SVG */
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#0a1a28"/>`;
for (const [a, b] of seaRoutes) svg += `<line x1="${artCenter[a][0]}" y1="${artCenter[a][1]}" x2="${artCenter[b][0]}" y2="${artCenter[b][1]}" stroke="#3a5568" stroke-width="2" stroke-dasharray="4 6"/>`;
for (let n = 1; n <= 169; n++) { if (!artPath[n]) continue; const col = titulosOut[tituloOf[n]].color; svg += `<path d="${artPath[n]}" fill="${col}" fill-opacity="0.9" stroke="#0a1a28" stroke-width="1"/>`; }
for (const t of TITULOS) { const c = titulosOut[t.id].labelCenter; svg += `<text x="${c[0]}" y="${c[1]}" font-size="46" text-anchor="middle" font-family="sans-serif">${t.emblem || ''}</text>`; }
svg += '</svg>';
fs.writeFileSync(path.join(__dirname, 'preview.svg'), svg);
console.log('✓ map-data.js y preview.svg generados');
