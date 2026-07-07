/* =========================================================================
   Generador del mundo "Constitucia" — DOS CONTINENTES separados por un mar,
   inspirados en mapas de fantasía tipo Poniente/Essos:
     - "home" (más pequeño): Preliminar + Título I + Título II. Aquí se
       empieza siempre, en el norte (El Confín Helado).
     - "far" (más grande): Títulos III a VIII. Se llega cruzando el mar
       por una ruta marítima obligatoria.
     - 2 islas costeras (Títulos IX y X) frente a la costa de "far".

   Niveles de generación:
   1. Silueta de cada continente (perfil de anchura norte→sur propio),
      con costa orgánica (jitter + ondas de bahía, no solo ruido).
   2. Cada TÍTULO es una REGIÓN de su continente (Voronoi ponderado por
      número de artículos, semillas colocadas de norte a sur, restringido
      a las celdas del continente al que pertenece).
   3. Si un título tiene capítulos, su región se divide en COMARCAS
      separadas por una curva orgánica (río: meandro suave; cordillera:
      quiebros más bruscos) — la curva se genera primero y se usa
      DIRECTAMENTE tanto para clasificar celdas como para dibujar la
      frontera decorativa, así es orgánica por construcción.
   4. Cada comarca se subdivide en un TERRITORIO por artículo (Voronoi
      ponderado + relajación de Lloyd).

   Produce js/map-data.js con: paths y centros de los 169 territorios,
   metadatos de título/capítulo, adyacencias, rutas marítimas (cruce
   obligatorio entre continentes + hacia las 2 islas) y las fronteras
   decorativas río/cordillera entre capítulos.
   Uso: npm run map
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

/* ═══════════════ 1. Siluetas de los dos continentes ═══════════════ */
function makeInterp(profile) {
  return (t) => {
    for (let i = 0; i < profile.length - 1; i++) {
      const [t0, hw0, sw0] = profile[i], [t1, hw1, sw1] = profile[i + 1];
      if (t >= t0 && t <= t1) {
        const f = (t - t0) / (t1 - t0 || 1);
        const s = f * f * (3 - 2 * f); // smoothstep
        return [hw0 + (hw1 - hw0) * s, sw0 + (sw1 - sw0) * s];
      }
    }
    return [profile[profile.length - 1][1], profile[profile.length - 1][2]];
  };
}
/* "home": norte frío y estrecho → cuello → tierras anchas (Título I) →
   península sur (La Corona). Inspirado en Poniente. */
const PROFILE_HOME = [
  [0.00, 0.10, 0.00], [0.05, 0.24, 0.00], [0.13, 0.34, 0.03], [0.24, 0.30, 0.05],
  [0.33, 0.14, 0.02], [0.40, 0.17, 0.00], [0.52, 0.33, -0.03], [0.66, 0.36, 0.02],
  [0.78, 0.27, -0.02], [0.90, 0.15, 0.01], [0.97, 0.06, 0.00], [1.00, 0.02, 0.00],
];
/* "far": más ancho y sinuoso, con varios abultamientos y bahías —
   deliberadamente distinto del "home", inspirado en Essos. */
const PROFILE_FAR = [
  [0.00, 0.14, 0.10], [0.06, 0.26, -0.06], [0.14, 0.20, -0.14], [0.22, 0.32, -0.02],
  [0.32, 0.40, 0.06], [0.42, 0.34, -0.04], [0.50, 0.41, 0.02], [0.60, 0.36, 0.10],
  [0.70, 0.30, 0.02], [0.80, 0.34, -0.06], [0.90, 0.20, 0.00], [0.97, 0.09, 0.02], [1.00, 0.03, 0.00],
];
const HOME_CFG = { id: 'home', cx: 520, refW: 740, profile: PROFILE_HOME, seed: 20260707, jitterAmp: 0.026 };
const FAR_CFG = { id: 'far', cx: 1650, refW: 980, profile: PROFILE_FAR, seed: 20260808, jitterAmp: 0.03 };

function buildContinentPolygon(cfg) {
  const interp = makeInterp(cfg.profile);
  const rnd = mulberry(cfg.seed);
  const steps = 80, left = [], right = [];
  const w1f = 2 + rnd() * 1.5, w1p = rnd() * Math.PI * 2;
  const w2f = 5 + rnd() * 2.5, w2p = rnd() * Math.PI * 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, y = t * H;
    const [hwF, swF] = interp(t);
    const wob = Math.sin(t * Math.PI * 2 * w1f + w1p) * 0.05 + Math.sin(t * Math.PI * 2 * w2f + w2p) * 0.022;
    const jitterL = (rnd() - 0.5) * cfg.jitterAmp;
    const jitterR = (rnd() - 0.5) * cfg.jitterAmp;
    const spineX = cfg.cx + swF * cfg.refW;
    const hw = Math.max(0.02, hwF + wob) * cfg.refW;
    left.push([spineX - hw + jitterL * cfg.refW, y]);
    right.push([spineX + hw - jitterR * cfg.refW, y]);
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
const HOME_POLY = buildContinentPolygon(HOME_CFG);
const FAR_POLY = buildContinentPolygon(FAR_CFG);
const HOME = rasterizePoly(HOME_POLY);
const FAR = rasterizePoly(FAR_POLY);
const onLand = new Uint8Array(nx * ny);
for (let idx = 0; idx < nx * ny; idx++) onLand[idx] = (HOME.mask[idx] || FAR.mask[idx]) ? 1 : 0;

/* ═══════════════ 2. Regiones (títulos) por Voronoi ponderado, por continente ═══════════════ */
const HOME_TITULOS = TITULOS.filter((t) => t.continent === 'home' && !t.island);
const FAR_MAINLAND_TITULOS = TITULOS.filter((t) => t.continent === 'far' && !t.island);
const MAINLAND_TITULOS = HOME_TITULOS.concat(FAR_MAINLAND_TITULOS);
const ISLAND_TITULOS = TITULOS.filter((t) => t.island);

const TITULO_IDS = MAINLAND_TITULOS.map((t) => t.id);
const idIndex = {}; TITULO_IDS.forEach((id, k) => { idIndex[id] = k; });
const tituloLabel = new Int16Array(nx * ny).fill(-1);

function artCountOf(t) { return t.islands.reduce((s, is) => s + (is.arts[1] - is.arts[0] + 1), 0); }

const SEEDS_FRAC_HOME = { preliminar: [0.05, 0.00], t1: [0.46, -0.03], t2: [0.88, 0.05] };
const SEEDS_FRAC_FAR = { t3: [0.08, 0.00], t4: [0.24, 0.14], t5: [0.40, -0.15], t6: [0.55, 0.12], t7: [0.68, -0.10], t8: [0.87, 0.02] };

function seedPixelFor(cfg, seedsFrac) {
  const interp = makeInterp(cfg.profile);
  return (tid) => { const [yf, xoff] = seedsFrac[tid]; const [, swF] = interp(yf); return [cfg.cx + swF * cfg.refW + xoff * cfg.refW, yf * H]; };
}
function assignTitulosOnMask(mask, subset, seedPixelFn) {
  const ids = subset.map((t) => t.id);
  const artsMap = {}; let total = 0;
  for (const t of subset) { const n = artCountOf(t); artsMap[t.id] = n; total += n; }
  const { i0, i1, j0, j1 } = bboxOfMask(mask);
  let cellCount = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (mask[j * nx + i]) cellCount++;
  const target = ids.map((id) => (artsMap[id] / total) * cellCount);
  const pos = ids.map(seedPixelFn);
  const w = ids.map(() => 0);
  function pass() {
    const areas = ids.map(() => 0);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const idx = j * nx + i; if (!mask[idx]) continue;
      const x = cx(i), y = cy(j);
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
assignTitulosOnMask(HOME.mask, HOME_TITULOS, seedPixelFor(HOME_CFG, SEEDS_FRAC_HOME));
assignTitulosOnMask(FAR.mask, FAR_MAINLAND_TITULOS, seedPixelFor(FAR_CFG, SEEDS_FRAC_FAR));

/* reasignar fragmentos desconectados de un título al vecino mayoritario */
function fixFragments(labelArr, validCells) {
  for (let pass = 0; pass < 6; pass++) {
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

/* ═══════════════ 3. Comarcas de capítulo: curva orgánica primero ═══════════════ */
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

  /* posiciones base de corte, proporcionales al nº de artículos de cada capítulo */
  const baselines = [];
  let cursor = 0;
  for (let k = 0; k < t.islands.length - 1; k++) {
    const n = t.islands[k].arts[1] - t.islands[k].arts[0] + 1;
    cursor += Math.round((n / totalArts) * sorted.length);
    const c = Math.min(Math.max(cursor, 1), sorted.length - 1);
    baselines.push(cutCoord(sorted[c]));
  }

  /* amplitud de la onda: acotada al 35% del hueco mínimo entre cortes vecinos,
     para que las curvas nunca se crucen entre sí. */
  const bounds = [cutMin, ...baselines, cutMax];
  let minGap = Infinity;
  for (let k = 0; k < bounds.length - 1; k++) minGap = Math.min(minGap, bounds[k + 1] - bounds[k]);
  const amp = Math.max(2, minGap * 0.35);
  const isMountains = t.chapterDivider === 'mountains';

  const seedBase = 5000 + tIndex * 191;
  const curves = baselines.map((base, k) => {
    const rnd = mulberry(seedBase + k * 37);
    const nH = isMountains ? 5 : 3;
    const harmonics = [];
    for (let h = 0; h < nH; h++) {
      const freq = (isMountains ? 2 : 1) + h * (isMountains ? 2.1 : 1.6) + rnd() * 0.7;
      const a = amp * (isMountains ? (0.5 - h * 0.07) : (0.55 - h * 0.15));
      harmonics.push({ freq, phase: rnd() * Math.PI * 2, amp: a });
    }
    const fn = (u) => harmonics.reduce((s, h) => s + Math.sin(u * Math.PI * 2 * h.freq + h.phase) * h.amp, 0);
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
  capLabel[tid] = { label, order, axis, curves, alongMin, alongMax, isMountains };
}
TITULO_IDS.forEach((tid, k) => sliceIntoChapterBandsOrganic(tid, k));

/* ═══════════════ islas costeras (Títulos IX y X), junto al continente "far" ═══════════════ */
function blobPolygon(ccx, ccy, r, seed) {
  const rnd = mulberry(seed);
  const n = 20, pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const jr = 0.82 + rnd() * 0.34; pts.push([ccx + Math.cos(a) * r * jr, ccy + Math.sin(a) * r * jr]); }
  return pts;
}
/* colchón de mar: dilata toda la tierra (ambos continentes) varias pasadas
   para garantizar un estrecho real entre continentes/islas (nunca se tocan). */
const COAST_GAP_CELLS = 14; // ≈ 14*STEP px de mar mínimo
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
const UNIT_FAR = (FAR.count * STEP * STEP) / FAR_ARTS_TOTAL; // px² por artículo (escala de referencia)
const ISLAND_SEEDS_FRAC = { t9: [0.28, 0.62], t10: [0.58, 0.66] };
const islandCellLabel = new Int16Array(nx * ny).fill(-1);
const interpFar = makeInterp(FAR_CFG.profile);
for (let k = 0; k < ISLAND_TITULOS.length; k++) {
  const t = ISLAND_TITULOS[k];
  const arts = t.islands[0].arts[1] - t.islands[0].arts[0] + 1;
  const area = arts * UNIT_FAR;
  const r = Math.sqrt(area / Math.PI) * 1.12;
  const [yf, xoff] = ISLAND_SEEDS_FRAC[t.id];
  const [, swF] = interpFar(yf);
  const c = [FAR_CFG.cx + swF * FAR_CFG.refW + xoff * FAR_CFG.refW, yf * H];
  const poly = blobPolygon(c[0], c[1], r, 9000 + k * 77);
  const i0 = Math.max(0, Math.floor((c[0] - r * 1.3) / STEP)), i1 = Math.min(nx - 1, Math.ceil((c[0] + r * 1.3) / STEP));
  const j0 = Math.max(0, Math.floor((c[1] - r * 1.3) / STEP)), j1 = Math.min(ny - 1, Math.ceil((c[1] + r * 1.3) / STEP));
  const label = new Int16Array(nx * ny).fill(-1);
  let placed = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const idx = j * nx + i;
    if (nearCoast[idx] || islandCellLabel[idx] >= 0) continue; // deja siempre mar entre isla y costa
    if (inPoly(cx(i), cy(j), poly)) { islandCellLabel[idx] = k; label[idx] = 0; placed++; }
  }
  if (placed === 0) console.error(`¡Isla ${t.id} sin celdas! Ajusta ISLAND_SEEDS_FRAC.`);
  capMeta[t.islands[0].id] = { name: t.islands[0].name, tituloId: t.id, arts: artsOf(t.islands[0].arts) };
  capLabel[t.id] = { label, order: [t.islands[0].id] };
}

/* ═══════════════ 4. Territorios (un artículo por celda-capítulo, Voronoi + Lloyd) ═══════════════ */
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
      const i = cellIdxs[c] % nx, j = (cellIdxs[c] / nx) | 0, x = cx(i), y = cy(j);
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
  for (let pass = 0; pass < 6; pass++) {
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
  pts = dp(pts, 1.4); pts = chaikin(chaikin(pts)); pts = dp(pts, 0.6);
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

/* ═══════════════ rutas marítimas: cruce obligatorio home↔far + 2 islas ═══════════════ */
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
  const mainland = [...reach];
  const pair = nearestPair(mainland, islArts);
  if (pair) addSea(pair[0], pair[1]);
}
// red de seguridad: cualquier resto desconectado se une por el par más cercano
let guard = 0;
while (guard++ < 20) {
  const reach = reachableFrom(START_ART);
  if (reach.size === 169) break;
  const outside = []; for (let n = 1; n <= 169; n++) if (!reach.has(n)) outside.push(n);
  const pair = nearestPair([...reach], outside);
  if (!pair) break;
  addSea(pair[0], pair[1]);
}

/* ═══════════════ fronteras decorativas río/cordillera: la curva ES la frontera ═══════════════ */
const chapterBorders = [];
for (const t of MAINLAND_TITULOS) {
  if (t.islands.length <= 1 || !t.chapterDivider) continue;
  const capInfo = capLabel[t.id];
  const { axis, curves, alongMin, alongMax } = capInfo;
  for (const curve of curves) {
    const steps = 90, pts = [];
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const alongVal = alongMin + (alongMax - alongMin) * u;
      const cutVal = curve.base + curve.fn(u);
      pts.push(axis === 'y' ? [alongVal, cutVal] : [cutVal, alongVal]);
    }
    let chain = pts;
    if (t.chapterDivider === 'river') { chain = chaikin(chain, false); chain = chaikin(chain, false); }
    else { chain = dp(chain, 1.5); } // cordilleras: más quiebros, menos suavizado
    const d = 'M' + chain.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L');
    chapterBorders.push({ tituloId: t.id, style: t.chapterDivider, name: t.dividerName, path: d });
  }
}

/* ═══════════════ informe ═══════════════ */
const reachFinal = reachableFrom(START_ART);
console.log('Artículos:', Object.keys(artPath).length, '| conexos desde art.', START_ART, ':', reachFinal.size, '/169');
console.log('Continente home: celdas=', HOME.count, '| far: celdas=', FAR.count);
console.log('Rutas marítimas (cruce + islas):', seaRoutes.length, '| fronteras río/cordillera:', chapterBorders.length);
for (const t of TITULOS) {
  const n = artCountOf(t);
  console.log(`  ${(t.roman || 'Prel.').padEnd(5)} ${t.name.slice(0, 26).padEnd(26)} arts=${String(n).padStart(2)} capítulos=${t.islands.length} continente=${t.continent || '-'}${t.island ? ' (isla)' : ''}`);
}

/* ═══════════════ salida ═══════════════ */
const adjOut = {}; for (let n = 1; n <= 169; n++) adjOut[n] = [...adj[n]].sort((a, b) => a - b);
const islandsOut = {}; for (const [id, m] of Object.entries(capMeta)) islandsOut[id] = { name: m.name, tituloId: m.tituloId, center: artCenter[m.arts[Math.floor(m.arts.length / 2)]] || [0, 0], arts: m.arts };
const titulosOut = {}; for (const t of TITULOS) titulosOut[t.id] = { name: t.name, theme: t.theme, color: t.color, roman: t.roman, islands: t.islands.map((is) => is.id), continent: t.continent || null };

const out = `/* Generado por tools/gen-map.js — mundo Constitucia (2 continentes, 169 territorios) */
const MAP = ${JSON.stringify({ view: [W, H], art: { path: artPath, center: artCenter, island: islandOf, titulo: tituloOf }, islands: islandsOut, titulos: titulosOut, adj: adjOut, seaRoutes, chapterBorders }, null, 0)};
if (typeof module !== 'undefined') module.exports = { MAP };
`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'map-data.js'), out);

/* preview SVG */
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#0a1a28"/>`;
for (const [a, b] of seaRoutes) svg += `<line x1="${artCenter[a][0]}" y1="${artCenter[a][1]}" x2="${artCenter[b][0]}" y2="${artCenter[b][1]}" stroke="#3a5568" stroke-width="2" stroke-dasharray="4 6"/>`;
for (let n = 1; n <= 169; n++) { if (!artPath[n]) continue; const col = titulosOut[tituloOf[n]].color; svg += `<path d="${artPath[n]}" fill="${col}" fill-opacity="0.9" stroke="#0a1a28" stroke-width="1"/>`; }
for (const cb of chapterBorders) svg += `<path d="${cb.path}" fill="none" stroke="${cb.style === 'river' ? '#5fc7e0' : '#efe6d0'}" stroke-width="${cb.style === 'river' ? 5 : 3}" stroke-linecap="round" opacity="0.9"/>`;
for (let n = 1; n <= 169; n++) { if (!artCenter[n]) continue; svg += `<text x="${artCenter[n][0]}" y="${artCenter[n][1] + 4}" font-size="10" fill="#fff" text-anchor="middle" font-family="sans-serif">${n}</text>`; }
svg += '</svg>';
fs.writeFileSync(path.join(__dirname, 'preview.svg'), svg);
console.log('✓ map-data.js y preview.svg generados');
