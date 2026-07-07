/* =========================================================================
   Generador del mundo "Constitucia" — DOS CONTINENTES al estilo del mapa
   de Poniente/Essos:
     - "home" (Poniente): continente ALTO y estrecho a la izquierda, orientado
       norte→sur. Preliminar + Título I + Título II. Aquí se empieza siempre,
       en el norte (El Confín Helado).
     - "far" (Essos): continente ANCHO y horizontal a la derecha, orientado
       oeste→este. Títulos III a VIII. Se llega cruzando el mar estrecho por
       una ruta marítima obligatoria.
     - 2 islas (Títulos IX y X) al este de Essos.

   Diseño:
   1. Silueta de cada continente con un perfil de grosor a lo largo de su eje
      (vertical para "home", horizontal para "far") y costa orgánica.
   2. Cada TÍTULO es una REGIÓN (Voronoi ponderado por nº de artículos). Las
      fronteras se deforman con un campo de ruido (domain warp) para que sean
      SINUOSAS, no rectas — como el terreno real.
   3. Si un título tiene capítulos, su región se divide en COMARCAS separadas
      por un RÍO orgánico (curva serpenteante). El río se RECORTA al interior:
      nunca se mete en el mar.
   4. Cada comarca se subdivide en un TERRITORIO por artículo (Voronoi + Lloyd,
      con el mismo domain warp → bordes sinuosos que teselan sin huecos).

   Produce js/map-data.js. Uso: npm run map
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { TITULOS } = require('../js/hierarchy.js');

const W = 2300, H = 1900, STEP = 3;
const nx = Math.floor(W / STEP), ny = Math.floor(H / STEP);
const cx = (i) => i * STEP + STEP / 2;
const cy = (j) => j * STEP + STEP / 2;

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

/* ═══════════════ campo de ruido para bordes sinuosos (domain warp) ═══════════════ */
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
const WARP = 19; // px de desplazamiento de las fronteras
const warpX = (x, y) => x + noiseX(x, y) * WARP;
const warpY = (x, y) => y + noiseY(x, y) * WARP;

/* ═══════════════ 1. Siluetas de los dos continentes ═══════════════ */
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
/* Perfil = [t, grosor(0..1 del grosor máximo), desvío del eje(-1..1)] a lo
   largo del eje del continente. */
const PROFILE_HOME = [ // Poniente: norte fino → cuello → ancho → afila al sur
  [0.00, 0.28, 0.00], [0.05, 0.66, 0.00], [0.13, 0.95, 0.06], [0.24, 0.85, 0.10],
  [0.33, 0.40, 0.04], [0.40, 0.48, 0.00], [0.52, 0.92, -0.06], [0.66, 1.00, 0.04],
  [0.78, 0.75, -0.04], [0.90, 0.42, 0.02], [0.97, 0.17, 0.00], [1.00, 0.05, 0.00],
];
const PROFILE_FAR = [ // Essos: masa ancha, costa norte/sur irregular, afila al este
  [0.00, 0.52, 0.10], [0.07, 0.86, -0.04], [0.16, 0.70, -0.15], [0.26, 1.00, -0.02],
  [0.36, 0.92, 0.07], [0.46, 1.00, 0.00], [0.58, 0.86, 0.09], [0.70, 0.72, 0.00],
  [0.80, 0.80, -0.07], [0.90, 0.46, 0.00], [0.97, 0.18, 0.03], [1.00, 0.05, 0.00],
];
/* cfg del continente: base + axis definen el eje; thick es el medio-grosor
   máximo (perpendicular al eje). */
const HOME_CFG = { id: 'home', base: [560, 30], axis: [0, 1840], thick: 340, profile: PROFILE_HOME, seed: 20260707, jitter: 10, wobble: 34 };
const FAR_CFG = { id: 'far', base: [1075, 985], axis: [1150, 0], thick: 560, profile: PROFILE_FAR, seed: 20260808, jitter: 12, wobble: 46 };

function buildContinent(cfg) {
  const interp = makeInterp(cfg.profile);
  const rnd = mulberry(cfg.seed);
  const L = Math.hypot(cfg.axis[0], cfg.axis[1]);
  const dir = [cfg.axis[0] / L, cfg.axis[1] / L];
  const perp = [-dir[1], dir[0]];
  const steps = 90;
  const w1f = 2 + rnd() * 1.5, w1p = rnd() * Math.PI * 2;
  const w2f = 5 + rnd() * 2.5, w2p = rnd() * Math.PI * 2;
  const left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [hwF, swF] = interp(t);
    const wob = (Math.sin(t * Math.PI * 2 * w1f + w1p) + 0.5 * Math.sin(t * Math.PI * 2 * w2f + w2p)) * cfg.wobble;
    const spineOff = swF * cfg.thick;
    const cxp = cfg.base[0] + cfg.axis[0] * t + perp[0] * spineOff;
    const cyp = cfg.base[1] + cfg.axis[1] * t + perp[1] * spineOff;
    const half = hwF * cfg.thick + wob;
    const jl = (rnd() - 0.5) * cfg.jitter, jr = (rnd() - 0.5) * cfg.jitter;
    left.push([cxp + perp[0] * (half + jl), cyp + perp[1] * (half + jl)]);
    right.push([cxp - perp[0] * (half + jr), cyp - perp[1] * (half + jr)]);
  }
  let poly = left.concat(right.reverse());
  poly = chaikin(chaikin(poly)); poly = dp(poly, 1.2);
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

/* colocación de semillas dentro de un continente por (avance a lo largo del
   eje, desvío perpendicular). */
function seederFor(cfg) {
  const L = Math.hypot(cfg.axis[0], cfg.axis[1]);
  const dir = [cfg.axis[0] / L, cfg.axis[1] / L];
  const perp = [-dir[1], dir[0]];
  return (mainFrac, crossFrac) => [
    cfg.base[0] + cfg.axis[0] * mainFrac + perp[0] * crossFrac * cfg.thick,
    cfg.base[1] + cfg.axis[1] * mainFrac + perp[1] * crossFrac * cfg.thick,
  ];
}

/* ═══════════════ 2. Regiones (títulos) por Voronoi ponderado + warp ═══════════════ */
const HOME_TITULOS = TITULOS.filter((t) => t.continent === 'home' && !t.island);
const FAR_MAINLAND_TITULOS = TITULOS.filter((t) => t.continent === 'far' && !t.island);
const MAINLAND_TITULOS = HOME_TITULOS.concat(FAR_MAINLAND_TITULOS);
const ISLAND_TITULOS = TITULOS.filter((t) => t.island);

const TITULO_IDS = MAINLAND_TITULOS.map((t) => t.id);
const idIndex = {}; TITULO_IDS.forEach((id, k) => { idIndex[id] = k; });
const tituloLabel = new Int16Array(nx * ny).fill(-1);

function artCountOf(t) { return t.islands.reduce((s, is) => s + (is.arts[1] - is.arts[0] + 1), 0); }

const seedHome = seederFor(HOME_CFG);
const seedFar = seederFor(FAR_CFG);
const SEEDS_HOME = { preliminar: seedHome(0.09, 0.00), t1: seedHome(0.50, -0.05), t2: seedHome(0.90, 0.05) };
const SEEDS_FAR = {
  t3: seedFar(0.10, 0.05), t4: seedFar(0.30, -0.42), t5: seedFar(0.32, 0.45),
  t6: seedFar(0.52, -0.28), t7: seedFar(0.58, 0.46), t8: seedFar(0.82, -0.02),
};

function assignTitulosOnMask(mask, subset, seeds) {
  const ids = subset.map((t) => t.id);
  const artsMap = {}; let total = 0;
  for (const t of subset) { const n = artCountOf(t); artsMap[t.id] = n; total += n; }
  const { i0, i1, j0, j1 } = bboxOfMask(mask);
  let cellCount = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (mask[j * nx + i]) cellCount++;
  const target = ids.map((id) => (artsMap[id] / total) * cellCount);
  const pos = ids.map((id) => seeds[id]);
  const w = ids.map(() => 0);
  function pass() {
    const areas = ids.map(() => 0);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const idx = j * nx + i; if (!mask[idx]) continue;
      const x = warpX(cx(i), cy(j)), y = warpY(cx(i), cy(j));
      let best = -1, bd = Infinity;
      for (let k = 0; k < ids.length; k++) {
        const d = (x - pos[k][0]) ** 2 + (y - pos[k][1]) ** 2 - w[k];
        if (d < bd) { bd = d; best = k; }
      }
      tituloLabel[idx] = idIndex[ids[best]];
      areas[best]++;
    }
    return areas;
  }
  for (let it = 0; it < 140; it++) {
    const areas = pass();
    for (let k = 0; k < ids.length; k++) w[k] += 850 * ((target[k] - areas[k]) / target[k]);
  }
  pass();
}
assignTitulosOnMask(HOME.mask, HOME_TITULOS, SEEDS_HOME);
assignTitulosOnMask(FAR.mask, FAR_MAINLAND_TITULOS, SEEDS_FAR);

/* reasignar fragmentos desconectados de un título al vecino mayoritario */
function fixFragments(labelArr, validCells) {
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    const seen = new Int32Array(nx * ny).fill(-1);
    const compsByLabel = {};
    for (let idx = 0; idx < nx * ny; idx++) {
      if (!validCells(idx)) continue;
      const a = labelArr[idx]; if (a < 0 || seen[idx] >= 0) continue;
      const comp = [idx]; seen[idx] = 1;
      for (let p = 0; p < comp.length; p++) {
        const c = comp[p], ci = c % nx, cj = (c / nx) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const nidx = nj * nx + ni;
          if (!validCells(nidx)) continue;
          if (labelArr[nidx] === a && seen[nidx] < 0) { seen[nidx] = 1; comp.push(nidx); }
        }
      }
      (compsByLabel[a] = compsByLabel[a] || []).push(comp);
    }
    for (const a of Object.keys(compsByLabel)) {
      const comps = compsByLabel[a]; if (comps.length <= 1) continue;
      comps.sort((x, y) => y.length - x.length);
      for (let c = 1; c < comps.length; c++) for (const idx of comps[c]) {
        const ci = idx % nx, cj = (idx / nx) | 0; const votes = {};
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const nidx = nj * nx + ni; if (!validCells(nidx)) continue;
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

/* ═══════════════ tierra "profunda": ≥ RIVER_INLAND celdas de la costa ═══════════════
   (para que los ríos no se metan en el mar). */
const RIVER_INLAND = 9;
let deepLand = onLand;
for (let r = 0; r < RIVER_INLAND; r++) {
  const next = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const idx = j * nx + i; if (!deepLand[idx]) continue;
    let keep = true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny || !deepLand[nj * nx + ni]) { keep = false; break; }
    }
    next[idx] = keep ? 1 : 0;
  }
  deepLand = next;
}

/* ═══════════════ 3. Comarcas de capítulo: río orgánico (curva primero) ═══════════════ */
const capLabel = {}; // tituloId -> { label, order, axis, curves, alongMin, alongMax }
const capMeta = {};  // capId -> { name, tituloId, arts:[...] }

function sliceIntoChapterBandsOrganic(tid, tIndex) {
  const t = TITULOS.find((x) => x.id === tid);
  const cellIdxs = [];
  for (let idx = 0; idx < nx * ny; idx++) if (onLand[idx] && tituloLabel[idx] === tIndex) cellIdxs.push(idx);
  const label = new Int16Array(nx * ny).fill(-1);

  if (t.islands.length === 1) {
    for (const idx of cellIdxs) label[idx] = 0;
    capMeta[t.islands[0].id] = { name: t.islands[0].name, tituloId: tid, arts: artsOf(t.islands[0].arts) };
    capLabel[tid] = { label, order: [t.islands[0].id] };
    return;
  }

  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (const idx of cellIdxs) { const i = idx % nx, j = (idx / nx) | 0; const x = cx(i), y = cy(j); if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const axis = (maxY - minY) >= (maxX - minX) ? 'y' : 'x';
  const cutCoord = (idx) => { const i = idx % nx, j = (idx / nx) | 0; return axis === 'y' ? cy(j) : cx(i); };
  const alongCoord = (idx) => { const i = idx % nx, j = (idx / nx) | 0; return axis === 'y' ? cx(i) : cy(j); };
  const cutMin = axis === 'y' ? minY : minX, cutMax = axis === 'y' ? maxY : maxX;
  const alongMin = axis === 'y' ? minX : minY, alongMax = axis === 'y' ? maxX : maxY;

  const sorted = cellIdxs.slice().sort((a, b) => cutCoord(a) - cutCoord(b));
  const totalArts = t.islands.reduce((s, is) => s + (is.arts[1] - is.arts[0] + 1), 0);

  const baselines = [];
  let cursor = 0;
  for (let k = 0; k < t.islands.length - 1; k++) {
    const n = t.islands[k].arts[1] - t.islands[k].arts[0] + 1;
    cursor += Math.round((n / totalArts) * sorted.length);
    const c = Math.min(Math.max(cursor, 1), sorted.length - 1);
    baselines.push(cutCoord(sorted[c]));
  }

  const bounds = [cutMin, ...baselines, cutMax];
  let minGap = Infinity;
  for (let k = 0; k < bounds.length - 1; k++) minGap = Math.min(minGap, bounds[k + 1] - bounds[k]);
  const amp = Math.max(2, minGap * 0.34);

  const seedBase = 5000 + tIndex * 191;
  const curves = baselines.map((base, k) => {
    const rnd = mulberry(seedBase + k * 37);
    const harmonics = [];
    for (let h = 0; h < 3; h++) {
      const freq = 1 + h * 1.6 + rnd() * 0.7;
      const a = amp * (0.55 - h * 0.15);
      harmonics.push({ freq, phase: rnd() * Math.PI * 2, amp: a });
    }
    const fn = (u) => harmonics.reduce((s, hh) => s + Math.sin(u * Math.PI * 2 * hh.freq + hh.phase) * hh.amp, 0);
    return { base, fn };
  });
  const uOf = (v) => (v - alongMin) / ((alongMax - alongMin) || 1);
  const curveVal = (curve, alongVal) => curve.base + curve.fn(uOf(alongVal));

  for (const idx of cellIdxs) {
    const cc = cutCoord(idx), ac = alongCoord(idx);
    let band = 0;
    for (const curve of curves) if (cc > curveVal(curve, ac)) band++;
    label[idx] = Math.min(band, t.islands.length - 1);
  }

  const order = [];
  t.islands.forEach((is) => { capMeta[is.id] = { name: is.name, tituloId: tid, arts: artsOf(is.arts) }; order.push(is.id); });
  capLabel[tid] = { label, order, axis, curves, alongMin, alongMax, tIndex };
}
TITULO_IDS.forEach((tid, k) => sliceIntoChapterBandsOrganic(tid, k));

/* ═══════════════ islas (Títulos IX y X), al este de Essos ═══════════════ */
function blobPolygon(ccx, ccy, r, seed) {
  const rnd = mulberry(seed);
  const n = 22, pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const jr = 0.80 + rnd() * 0.36; pts.push([ccx + Math.cos(a) * r * jr, ccy + Math.sin(a) * r * jr]); }
  return chaikin(pts);
}
const COAST_GAP_CELLS = 14;
let nearCoast = onLand;
for (let r = 0; r < COAST_GAP_CELLS; r++) {
  const next = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const idx = j * nx + i;
    if (nearCoast[idx]) { next[idx] = 1; continue; }
    let near = false;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni >= 0 && nj >= 0 && ni < nx && nj < ny && nearCoast[nj * nx + ni]) { near = true; break; }
    }
    next[idx] = near ? 1 : 0;
  }
  nearCoast = next;
}

const FAR_ARTS_TOTAL = FAR_MAINLAND_TITULOS.reduce((s, t) => s + artCountOf(t), 0);
const UNIT_FAR = (FAR.count * STEP * STEP) / FAR_ARTS_TOTAL;
const ISLAND_CENTERS = { t9: [2045, 380], t10: [2170, 1510] };
const islandCellLabel = new Int16Array(nx * ny).fill(-1);
for (let k = 0; k < ISLAND_TITULOS.length; k++) {
  const t = ISLAND_TITULOS[k];
  const arts = t.islands[0].arts[1] - t.islands[0].arts[0] + 1;
  const area = arts * UNIT_FAR;
  const r = Math.sqrt(area / Math.PI) * 1.12;
  const c = ISLAND_CENTERS[t.id];
  const poly = blobPolygon(c[0], c[1], r, 9000 + k * 77);
  const i0 = Math.max(0, Math.floor((c[0] - r * 1.4) / STEP)), i1 = Math.min(nx - 1, Math.ceil((c[0] + r * 1.4) / STEP));
  const j0 = Math.max(0, Math.floor((c[1] - r * 1.4) / STEP)), j1 = Math.min(ny - 1, Math.ceil((c[1] + r * 1.4) / STEP));
  const label = new Int16Array(nx * ny).fill(-1);
  let placed = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const idx = j * nx + i;
    if (nearCoast[idx] || islandCellLabel[idx] >= 0) continue;
    if (inPoly(cx(i), cy(j), poly)) { islandCellLabel[idx] = k; label[idx] = 0; placed++; }
  }
  if (placed === 0) console.error(`¡Isla ${t.id} sin celdas! Ajusta ISLAND_CENTERS.`);
  capMeta[t.islands[0].id] = { name: t.islands[0].name, tituloId: t.id, arts: artsOf(t.islands[0].arts) };
  capLabel[t.id] = { label, order: [t.islands[0].id] };
}

/* ═══════════════ 4. Territorios (un artículo por celda-capítulo) + warp ═══════════════ */
const artLabel = new Int32Array(nx * ny).fill(-1);
let seedCounter = 1;
function rasterizeArticlesInCap(capId, tid) {
  const meta = capMeta[capId];
  const arts = meta.arts;
  const { label } = capLabel[tid];
  const cellIdxs = []; const capIndex = capLabel[tid].order.indexOf(capId);
  for (let idx = 0; idx < nx * ny; idx++) if (label[idx] === capIndex) cellIdxs.push(idx);
  if (!cellIdxs.length) { console.error('¡Capítulo sin celdas!', capId); return; }

  if (arts.length === 1) { for (const idx of cellIdxs) artLabel[idx] = arts[0]; return; }

  const rnd = mulberry(seedCounter++ * 733 + 11);
  let seeds = arts.map(() => { const c = cellIdxs[Math.floor(rnd() * cellIdxs.length)]; return [cx(c % nx), cy((c / nx) | 0)]; });
  const assign = new Array(cellIdxs.length).fill(0);
  for (let it = 0; it < 12; it++) {
    for (let c = 0; c < cellIdxs.length; c++) {
      const i = cellIdxs[c] % nx, j = (cellIdxs[c] / nx) | 0;
      const x = warpX(cx(i), cy(j)), y = warpY(cx(i), cy(j));
      let best = 0, bd = Infinity;
      for (let s = 0; s < seeds.length; s++) { const d = (x - seeds[s][0]) ** 2 + (y - seeds[s][1]) ** 2; if (d < bd) { bd = d; best = s; } }
      assign[c] = best;
    }
    const sx = seeds.map(() => 0), sy = seeds.map(() => 0), sn = seeds.map(() => 0);
    for (let c = 0; c < cellIdxs.length; c++) { const k = assign[c]; const i = cellIdxs[c] % nx, j = (cellIdxs[c] / nx) | 0; sx[k] += cx(i); sy[k] += cy(j); sn[k]++; }
    for (let s = 0; s < seeds.length; s++) if (sn[s]) seeds[s] = [sx[s] / sn[s], sy[s] / sn[s]];
  }
  for (let c = 0; c < cellIdxs.length; c++) artLabel[cellIdxs[c]] = arts[assign[c]];
}
for (const tid of Object.keys(capLabel)) for (const capId of capLabel[tid].order) rasterizeArticlesInCap(capId, tid);

/* reasignar fragmentos desconectados de un artículo */
function fixArtFragments() {
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    const seen = new Int32Array(nx * ny).fill(-1);
    const compsByArt = {};
    for (let idx = 0; idx < nx * ny; idx++) {
      const a = artLabel[idx]; if (a < 0 || seen[idx] >= 0) continue;
      const comp = [idx]; seen[idx] = 1;
      for (let p = 0; p < comp.length; p++) {
        const c = comp[p], ci = c % nx, cj = (c / nx) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const nidx = nj * nx + ni;
          if (artLabel[nidx] === a && seen[nidx] < 0) { seen[nidx] = 1; comp.push(nidx); }
        }
      }
      (compsByArt[a] = compsByArt[a] || []).push(comp);
    }
    for (const a of Object.keys(compsByArt)) {
      const comps = compsByArt[a]; if (comps.length <= 1) continue;
      comps.sort((x, y) => y.length - x.length);
      for (let c = 1; c < comps.length; c++) for (const idx of comps[c]) {
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

/* ═══════════════ marching squares (paths de artículo) ═══════════════ */
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
for (const tid of Object.keys(capLabel)) for (const capId of capLabel[tid].order) for (const n of capMeta[capId].arts) { islandOf[n] = capId; tituloOf[n] = tid; }

/* ═══════════════ adyacencia terrestre ═══════════════ */
const adj = {}; for (let n = 1; n <= 169; n++) adj[n] = new Set();
for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
  const a = artLabel[j * nx + i]; if (a < 0) continue;
  for (const [di, dj] of [[1, 0], [0, 1]]) {
    const ni = i + di, nj = j + dj; if (ni >= nx || nj >= ny) continue;
    const b = artLabel[nj * nx + ni]; if (b >= 0 && b !== a) { adj[a].add(b); adj[b].add(a); }
  }
}

/* ═══════════════ rutas marítimas: cruce home↔far + 2 islas ═══════════════ */
const seaRoutes = [];
function nearestPair(a, b) { let best = null, bd = Infinity; for (const x of a) for (const y of b) { const d = (artCenter[x][0] - artCenter[y][0]) ** 2 + (artCenter[x][1] - artCenter[y][1]) ** 2; if (d < bd) { bd = d; best = [x, y]; } } return best; }
function addSea(a, b) { adj[a].add(b); adj[b].add(a); seaRoutes.push([a, b]); }
function reachableFrom(start) { const seen = new Set([start]); const st = [start]; while (st.length) { const c = st.pop(); for (const m of adj[c]) if (!seen.has(m)) { seen.add(m); st.push(m); } } return seen; }

const START_ART = TITULOS.find((t) => t.start).islands[0].arts[0];
{
  const reach = reachableFrom(START_ART);
  const farArts = []; for (const t of FAR_MAINLAND_TITULOS) for (const is of t.islands) for (const n of artsOf(is.arts)) farArts.push(n);
  if (!farArts.some((n) => reach.has(n))) {
    const pair = nearestPair([...reach], farArts);
    if (pair) addSea(pair[0], pair[1]);
  }
}
for (const t of ISLAND_TITULOS) {
  const islArts = capMeta[t.islands[0].id].arts;
  const reach = reachableFrom(START_ART);
  if (islArts.some((n) => reach.has(n))) continue;
  const pair = nearestPair([...reach], islArts);
  if (pair) addSea(pair[0], pair[1]);
}
let guard = 0;
while (guard++ < 20) {
  const reach = reachableFrom(START_ART);
  if (reach.size === 169) break;
  const outside = []; for (let n = 1; n <= 169; n++) if (!reach.has(n)) outside.push(n);
  const pair = nearestPair([...reach], outside);
  if (!pair) break;
  addSea(pair[0], pair[1]);
}

/* ═══════════════ ríos decorativos: la curva ES la frontera, recortada al interior ═══════════════ */
const chapterBorders = [];
for (const t of MAINLAND_TITULOS) {
  if (t.islands.length <= 1 || !t.chapterDivider) continue;
  const capInfo = capLabel[t.id];
  const { axis, curves, alongMin, alongMax, tIndex } = capInfo;
  for (const curve of curves) {
    const steps = 140, raw = [];
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const alongVal = alongMin + (alongMax - alongMin) * u;
      const cutVal = curve.base + curve.fn(u);
      raw.push(axis === 'y' ? [alongVal, cutVal] : [cutVal, alongVal]);
    }
    // recortar al interior "profundo" y al propio título → nunca toca el mar
    const ok = raw.map(([x, y]) => {
      const i = Math.floor(x / STEP), j = Math.floor(y / STEP);
      if (i < 0 || j < 0 || i >= nx || j >= ny) return false;
      const idx = j * nx + i;
      return deepLand[idx] === 1 && tituloLabel[idx] === tIndex;
    });
    // quedarnos con la tirada contigua más larga de puntos válidos
    let bestA = -1, bestB = -1, a = -1;
    for (let s = 0; s <= steps; s++) {
      if (ok[s] && a < 0) a = s;
      if ((!ok[s] || s === steps) && a >= 0) { const b = ok[s] ? s : s - 1; if (b - a > bestB - bestA) { bestA = a; bestB = b; } a = -1; }
    }
    if (bestA < 0 || bestB - bestA < 4) continue; // sin tramo interior suficiente
    let chain = raw.slice(bestA, bestB + 1);
    chain = chaikin(chain, false); chain = chaikin(chain, false);
    const d = 'M' + chain.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L');
    chapterBorders.push({ tituloId: t.id, style: 'river', name: t.dividerName, path: d });
  }
}

/* ═══════════════ informe ═══════════════ */
const reachFinal = reachableFrom(START_ART);
console.log('Artículos:', Object.keys(artPath).length, '| conexos desde art.', START_ART, ':', reachFinal.size, '/169');
console.log('Continente home (Poniente): celdas=', HOME.count, '| far (Essos): celdas=', FAR.count);
console.log('Rutas marítimas (cruce + islas):', seaRoutes.length, '| ríos:', chapterBorders.length);
for (const t of TITULOS) {
  const n = artCountOf(t);
  console.log(`  ${(t.roman || 'Prel.').padEnd(5)} ${t.name.slice(0, 26).padEnd(26)} arts=${String(n).padStart(2)} capítulos=${t.islands.length} continente=${t.continent || '-'}${t.island ? ' (isla)' : ''}`);
}

/* ═══════════════ salida ═══════════════ */
const adjOut = {}; for (let n = 1; n <= 169; n++) adjOut[n] = [...adj[n]].sort((a, b) => a - b);
const islandsOut = {}; for (const [id, m] of Object.entries(capMeta)) islandsOut[id] = { name: m.name, tituloId: m.tituloId, center: artCenter[m.arts[Math.floor(m.arts.length / 2)]] || [0, 0], arts: m.arts };
const titulosOut = {}; for (const t of TITULOS) titulosOut[t.id] = { name: t.name, theme: t.theme, color: t.color, roman: t.roman, emblem: t.emblem || t.faction.unit, islands: t.islands.map((is) => is.id), continent: t.continent || null };

const out = `/* Generado por tools/gen-map.js — mundo Constitucia (Poniente + Essos, 169 territorios) */
const MAP = ${JSON.stringify({ view: [W, H], art: { path: artPath, center: artCenter, island: islandOf, titulo: tituloOf }, islands: islandsOut, titulos: titulosOut, adj: adjOut, seaRoutes, chapterBorders }, null, 0)};
if (typeof module !== 'undefined') module.exports = { MAP };
`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'map-data.js'), out);

/* preview SVG */
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#0a1a28"/>`;
for (const [a, b] of seaRoutes) svg += `<line x1="${artCenter[a][0]}" y1="${artCenter[a][1]}" x2="${artCenter[b][0]}" y2="${artCenter[b][1]}" stroke="#3a5568" stroke-width="2" stroke-dasharray="4 6"/>`;
for (let n = 1; n <= 169; n++) { if (!artPath[n]) continue; const col = titulosOut[tituloOf[n]].color; svg += `<path d="${artPath[n]}" fill="${col}" fill-opacity="0.9" stroke="#0a1a28" stroke-width="1"/>`; }
for (const cb of chapterBorders) svg += `<path d="${cb.path}" fill="none" stroke="#5fc7e0" stroke-width="5" stroke-linecap="round" opacity="0.9"/>`;
for (const t of TITULOS) { const c = islandsOut[t.islands[0].id].center; svg += `<text x="${c[0]}" y="${c[1]}" font-size="46" text-anchor="middle" font-family="sans-serif">${t.emblem || ''}</text>`; }
svg += '</svg>';
fs.writeFileSync(path.join(__dirname, 'preview.svg'), svg);
console.log('✓ map-data.js y preview.svg generados');
