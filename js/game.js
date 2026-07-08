/* =========================================================================
   LA CONSTITUCIÓN: WARCHALLENGE — motor del juego
   Mundo "Constitucia" tipo Risk sobre la CE de 1978.
   - Continente único; los títulos con capítulos se dividen por río/cordillera.
   - 169 TERRITORIOS = 169 artículos. Se conquista un territorio respondiendo
     su pregunta. Modo preparación con un profesor por título.
   - Mapa con zoom/pan propio (no afecta a la página).
   Sin dependencias. Guardado en localStorage.
   ========================================================================= */

'use strict';

/* ───────────────────────── Constantes ───────────────────────── */

const SAVE_KEY = 'ce78_warchallenge_v3';
const BASE_POINTS = 100;
const TIME_BONUS_PER_S = 3;
const COMBO_STEP = 0.15;
const COMBO_MAX = 5;
const INCOME_TICK_MS = 12000;
const MEMORY_DANGER = 30;

/* Niveles de dificultad: tiempo de respuesta, ritmo de El Olvido y pérdida
   de territorios con el tiempo real. */
const DIFFICULTIES = {
  facil:   { name: 'Fácil',   emoji: '🌱', secs: 45, decayH: 48, loseEveryMin: 0,   desc: '45 s por pregunta · sin pérdidas por el paso del tiempo.' },
  normal:  { name: 'Normal',  emoji: '⚔️', secs: 30, decayH: 24, loseEveryMin: 0,   desc: '30 s por pregunta · El Olvido moderado.' },
  dificil: { name: 'Difícil', emoji: '🔥', secs: 20, decayH: 12, loseEveryMin: 60,  desc: '20 s por pregunta · pierdes 1 territorio cada hora que juegas.' },
};
function diff() { return DIFFICULTIES[S.difficulty] || DIFFICULTIES.normal; }
function qSeconds() { return diff().secs; }

const RANKS = [
  [1, 'Ciudadano/a'], [4, 'Elector/a'], [8, 'Concejal/a'], [12, 'Alcalde/sa'],
  [18, 'Diputado/a'], [25, 'Senador/a'], [33, 'Ministro/a'],
  [42, 'Presidente/a del Gobierno'], [55, 'Padre/Madre de la Constitución'],
];

const ACHIEVEMENTS = [
  { id: 'first',   icon: '🚩', name: 'Primera conquista',      desc: 'Conquista tu primer artículo.', pts: 200 },
  { id: 'prepared', icon: '🎓', name: 'Buen estudiante',       desc: 'Completa la preparación de un capítulo con su profesor.', pts: 200 },
  { id: 'combo5',  icon: '🔥', name: 'En racha',               desc: 'Encadena 5 aciertos seguidos.', pts: 300 },
  { id: 'combo10', icon: '🌋', name: 'Imparable',              desc: 'Encadena 10 aciertos seguidos.', pts: 600 },
  { id: 'combo20', icon: '☄️', name: 'Fuerza imparable',       desc: 'Encadena 20 aciertos seguidos.', pts: 1200 },
  { id: 'flash',   icon: '⚡', name: 'Reflejos de jurista',    desc: 'Acierta una pregunta en menos de 4 segundos.', pts: 200 },
  { id: 'cont1',   icon: '🏛️', name: 'Primer continente',      desc: 'Conquista un título entero.', pts: 500 },
  { id: 'archi',   icon: '🏞️', name: 'Cruza fronteras',         desc: 'Conquista un título completo dividido por río o cordillera.', pts: 800 },
  { id: 'derechos', icon: '🕊️', name: 'Guardián de derechos',  desc: 'Conquista el Título I completo (46 artículos).', pts: 1500 },
  { id: 'defender', icon: '🛡️', name: 'Defensor del Pueblo',   desc: 'Defiende con éxito un título de El Olvido.', pts: 400 },
  { id: 'sabio',   icon: '🦉', name: 'Constitucionalista',     desc: 'Responde correctamente 169 preguntas.', pts: 1500 },
  { id: 'mapa',    icon: '👑', name: '¡Viva la Constitución!',  desc: 'Conquista los 169 territorios.', pts: 5000 },
  { id: 'daily3',  icon: '📅', name: 'Costumbre parlamentaria', desc: 'Juega 3 días seguidos.', pts: 400 },
  { id: 'nivel15', icon: '🎖️', name: 'Alto cargo del Estado',  desc: 'Alcanza el nivel 15.', pts: 1000 },
];

const $ = (id) => document.getElementById(id);
const tituloById = (tid) => TITULOS.find((t) => t.id === tid);
const artsOfTitulo = (tid) => tituloById(tid).islands.flatMap((is) => rangeArts(is.arts));
const artsOfIsland = (islandId) => MAP.islands[islandId].arts;
function rangeArts(r) { const [a, b] = r; const o = []; for (let n = a; n <= b; n++) o.push(n); return o; }

/* ───────────────────────── Estado ───────────────────────── */

function defaultState() {
  const mem = {};
  for (const t of TITULOS) mem[t.id] = Date.now();
  return {
    owned: { 1: true },                 // se empieza con el art. 1
    prepared: {},                       // islandId -> true
    mem,                                // tid -> último refresco (El Olvido)
    score: 0, xp: 0, bestCombo: 0, prestige: 0,
    daily: { streak: 1, last: todayKey() },
    ach: [], sound: true, music: false, voice: true, seenIntro: false,
    difficulty: 'normal', lastLossTs: Date.now(),
    stats: { answers: 0, correct: 0, conquests: 0, defenses: 0, fastest: null, prepared: 0, playMs: 0 },
  };
}
function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultState();
    const s = { ...defaultState(), ...JSON.parse(raw) };
    if (!s.owned || !s.owned[1]) s.owned = { ...(s.owned || {}), 1: true };
    for (const t of TITULOS) if (!s.mem[t.id]) s.mem[t.id] = Date.now();
    if (!DIFFICULTIES[s.difficulty]) s.difficulty = 'normal';
    if (!s.lastLossTs) s.lastLossTs = Date.now();
    if (typeof s.stats.playMs !== 'number') s.stats.playMs = 0;
    return s;
  } catch { return defaultState(); }
}
let S = loadState();
let combo = 0;
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* */ } }
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }

/* ───────────────────────── Utilidades ───────────────────────── */

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fmt(n) { return Math.round(n).toLocaleString('es-ES'); }
function darken(hex, p) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; r *= 1 - p; g *= 1 - p; b *= 1 - p; return `rgb(${r | 0},${g | 0},${b | 0})`; }
function lighten(hex, p) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; r += (255 - r) * p; g += (255 - g) * p; b += (255 - b) * p; return `rgb(${r | 0},${g | 0},${b | 0})`; }

/* ───────────────────────── Sonido ───────────────────────── */

let audioCtx = null;
function tone(freq, dur = 0.12, type = 'sine', delay = 0, vol = 0.14) {
  if (!S.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime + delay;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(audioCtx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  } catch { /* */ }
}
const sfx = {
  correct() { tone(660, .1); tone(880, .14, 'sine', .08); },
  wrong() { tone(180, .25, 'sawtooth', 0, .12); tone(140, .3, 'sawtooth', .1, .1); },
  click() { tone(500, .05, 'triangle', 0, .07); },
  page() { tone(700, .05, 'sine', 0, .05); },
  conquest() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'triangle', i * .1, .17)); },
  defeat() { [330, 262, 196].forEach((f, i) => tone(f, .22, 'sine', i * .14, .13)); },
  ach() { tone(784, .1); tone(988, .1, 'sine', .09); tone(1319, .22, 'sine', .18); },
  tick() { tone(900, .04, 'square', 0, .05); },
};

/* ───────────────────────── Música (marcha épica, WebAudio, sin ficheros) ─────────────────────────
   Marcha militar clásica, épica pero tranquila, generada por procedimiento:
   bajo en marcha, redoble suave, pad de metales y una melodía en re menor
   sobre la progresión i–VI–III–VII (heroica). */
const music = { on: false, master: null, timer: null, next: 0, beat: 0, noise: null };
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const BEAT = 0.55; // ~109 BPM
const CHORDS = [ // 1 acorde por compás, [raíz(midi), triada]
  [50, [50, 53, 57]], // Dm
  [46, [46, 50, 53]], // Bb
  [53, [53, 57, 60]], // F
  [48, [48, 52, 55]], // C
];
const MELODY = [ // notas por compás (índice de beat 0..3 → semitono midi o null)
  [62, null, 65, 64], [65, null, 62, 57], [60, null, 64, 65], [67, null, 64, 62],
];
function noiseBuffer() {
  if (music.noise) return music.noise;
  const ctx = audioCtx; const b = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
  const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  music.noise = b; return b;
}
function mVoice(freq, t, dur, type, vol, cutoff) {
  const ctx = audioCtx; const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cutoff || 1800;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f).connect(g).connect(music.master); o.start(t); o.stop(t + dur + 0.03);
}
function mDrum(t, vol) {
  const ctx = audioCtx; const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  s.buffer = noiseBuffer(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  s.connect(f).connect(g).connect(music.master); s.start(t); s.stop(t + 0.14);
}
function scheduleBeat(beat, t) {
  const bar = Math.floor(beat / 4) % CHORDS.length, bi = beat % 4;
  const [root, triad] = CHORDS[bar];
  if (bi === 0 || bi === 2) mVoice(midi(root - 12), t, 0.5, 'triangle', 0.18, 500); // bajo en marcha
  if (bi === 1 || bi === 3) mDrum(t, 0.10);                                          // redoble
  mDrum(t, 0.03);                                                                    // pulso suave
  if (bi === 0) for (const s of triad) mVoice(midi(s), t, BEAT * 3.6, 'sawtooth', 0.035, 1100); // pad metales
  const mel = MELODY[bar][bi]; if (mel) mVoice(midi(mel), t, BEAT * 0.9, 'square', 0.05, 2200);  // melodía
}
function musicScheduler() {
  if (!music.on) return;
  while (music.next < audioCtx.currentTime + 0.25) { scheduleBeat(music.beat, music.next); music.next += BEAT; music.beat++; }
  music.timer = setTimeout(musicScheduler, 30);
}
function startMusic() {
  if (music.on) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    music.on = true; music.master = audioCtx.createGain(); music.master.gain.value = 0;
    music.master.connect(audioCtx.destination);
    music.master.gain.linearRampToValueAtTime(0.16, audioCtx.currentTime + 1.4);
    music.beat = 0; music.next = audioCtx.currentTime + 0.1; musicScheduler();
  } catch { music.on = false; }
}
function stopMusic() {
  if (!music.on) return; music.on = false; if (music.timer) clearTimeout(music.timer);
  try { music.master.gain.cancelScheduledValues(audioCtx.currentTime); music.master.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5); } catch { /* */ }
}

/* ───────────────────────── Voz (explica el artículo, Web Speech API) ───────────────────────── */
function stopVoice() { try { window.speechSynthesis && speechSynthesis.cancel(); } catch { /* */ } }
function pickVoice() {
  try { const vs = speechSynthesis.getVoices(); return vs.find((v) => /es[-_]ES/i.test(v.lang)) || vs.find((v) => /^es/i.test(v.lang)) || null; } catch { return null; }
}
function speakArticle(n) {
  if (!('speechSynthesis' in window)) { toast('Tu navegador no soporta la lectura en voz alta.'); return; }
  stopVoice();
  const a = ARTICLES[n]; const t = tituloById(MAP.art.titulo[n]);
  const marco = t.roman ? `del Título ${t.roman}, ${t.name}` : `del ${t.name}`;
  const text = `Artículo ${n}, ${marco}. ${a.t}. ${a.e} Para recordarlo: ${a.mn}`;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-ES'; u.rate = 1; u.pitch = 1;
  const v = pickVoice(); if (v) u.voice = v;
  try { speechSynthesis.speak(u); } catch { /* */ }
}

/* ───────────────────────── El Olvido / niveles ───────────────────────── */

function decayHours() { return Math.max(6, diff().decayH - S.prestige * 3); }
function memoryOf(tid) {
  const owned = artsOfTitulo(tid).filter((n) => S.owned[n]).length;
  if (owned === 0) return 100;
  const h = (Date.now() - (S.mem[tid] || Date.now())) / 3600000;
  return Math.max(0, Math.min(100, 100 - (h / decayHours()) * 100));
}
function refreshMemory(tid) { S.mem[tid] = Date.now(); }
function globalMult() { return (1 + 0.05 * Math.min(S.daily.streak - 1, 10)) * (1 + 0.5 * S.prestige); }
function comboMult() { return Math.min(COMBO_MAX, 1 + COMBO_STEP * Math.max(0, combo - 1)); }
function xpNeed(l) { return Math.round(300 * Math.pow(l, 1.75)); }
function levelFromXp(xp) { let l = 1; while (xp >= xpNeed(l)) l++; return l; }
function rankFor(l) { let n = RANKS[0][1]; for (const [lv, nm] of RANKS) if (l >= lv) n = nm; return n; }
function addXp(p) { const a = levelFromXp(S.xp); S.xp += Math.round(p / 3); const b = levelFromXp(S.xp); if (b > a) { toast(`🎖️ ¡Nivel ${b} — ${rankFor(b)}!`); sfx.ach(); if (b >= 15) unlock('nivel15'); } }

/* ───────────────────────── UI helpers ───────────────────────── */

function bump(el) { const p = el.parentElement; p.classList.add('bump'); setTimeout(() => p.classList.remove('bump'), 180); }
function toast(msg, cls = '') { const t = document.createElement('div'); t.className = `toast ${cls}`; t.textContent = msg; $('toasts').appendChild(t); setTimeout(() => t.remove(), 4200); }
function floater(text, x, y) { const f = document.createElement('div'); f.className = 'floater'; f.textContent = text; f.style.left = `${x}px`; f.style.top = `${y}px`; $('floaters').appendChild(f); setTimeout(() => f.remove(), 1400); }

function unlock(id) {
  if (S.ach.includes(id)) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id); if (!a) return;
  S.ach.push(id); toast(`🏆 Logro: ${a.name} (+${a.pts} pts)`, 'ach-toast'); sfx.ach();
  S.score += a.pts; S.xp += Math.round(a.pts / 3); renderHud(); save();
}

/* ───────────────────────── Racha diaria ───────────────────────── */

function checkDaily() {
  const today = todayKey(); if (S.daily.last === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yk = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
  S.daily.streak = (S.daily.last === yk) ? S.daily.streak + 1 : 1;
  S.daily.last = today;
  if (S.daily.streak > 1) { const b = 200 * Math.min(S.daily.streak, 10); S.score += b; toast(`📅 ¡${S.daily.streak} días seguidos! +${fmt(b)} pts`); }
  if (S.daily.streak >= 3) unlock('daily3');
  save();
}

/* ───────────────────────── Mapa SVG ───────────────────────── */

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}) { const e = document.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; }

let view = { x: 0, y: 0, w: 0, h: 0 };
const WORLD = { w: 0, h: 0 };

function statusOf(n) {
  if (S.owned[n]) return 'owned';
  return (MAP.adj[n] || []).some((m) => S.owned[m]) ? 'attackable' : 'locked';
}
function tituloConquered(tid) { return artsOfTitulo(tid).every((n) => S.owned[n]); }

function buildMap() {
  const svg = $('map');
  WORLD.w = MAP.view[0]; WORLD.h = MAP.view[1];
  view = { x: 0, y: 0, w: WORLD.w, h: WORLD.h };
  svg.setAttribute('viewBox', `0 0 ${WORLD.w} ${WORLD.h}`);
  svg.innerHTML = '';

  const defs = svgEl('defs');
  defs.innerHTML = `
    <radialGradient id="sea" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#16324a"/><stop offset="60%" stop-color="#0f2536"/><stop offset="100%" stop-color="#0a1a28"/>
    </radialGradient>
    <filter id="landSh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#000" flood-opacity="0.45"/>
    </filter>
    <marker id="mtnPeak" viewBox="0 0 10 10" refX="5" refY="7" markerWidth="8" markerHeight="8" orient="0">
      <polygon points="5,1 9,9 1,9" fill="#efe6d0" stroke="#7a7360" stroke-width="0.6"/>
    </marker>`;
  svg.appendChild(defs);
  svg.appendChild(svgEl('rect', { x: -2000, y: -2000, width: WORLD.w + 4000, height: WORLD.h + 4000, fill: 'url(#sea)' }));

  // olas decorativas
  const waves = svgEl('g', { opacity: '0.18' });
  for (let i = 0; i < 60; i++) {
    const wx = Math.random() * WORLD.w, wy = Math.random() * WORLD.h;
    waves.appendChild(svgEl('path', { d: `M ${wx} ${wy} q 10 -6 20 0 t 20 0`, stroke: '#4a7a9a', 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round' }));
  }
  svg.appendChild(waves);

  // rutas marítimas
  const routes = svgEl('g', { id: 'routes' });
  for (const [a, b] of MAP.seaRoutes) {
    const [ax, ay] = MAP.art.center[a], [bx, by] = MAP.art.center[b];
    const mx = (ax + bx) / 2, my = (ay + by) / 2 - 24;
    routes.appendChild(svgEl('path', { d: `M ${ax} ${ay} Q ${mx} ${my} ${bx} ${by}`, class: 'sea-route', 'data-a': a, 'data-b': b }));
  }
  svg.appendChild(routes);

  // sombra de las masas de tierra (une visualmente cada isla)
  const shadow = svgEl('g', { filter: 'url(#landSh)' });
  for (let n = 1; n <= 169; n++) shadow.appendChild(svgEl('path', { d: MAP.art.path[n], fill: '#0a1a28' }));
  svg.appendChild(shadow);

  // territorios (artículos)
  const terr = svgEl('g', { id: 'terr' });
  for (let n = 1; n <= 169; n++) {
    const g = svgEl('g', { class: 'terr', 'data-n': n });
    g.appendChild(svgEl('path', { d: MAP.art.path[n], class: 'land' }));
    const c = MAP.art.center[n];
    const t = svgEl('text', { x: c[0], y: c[1] + 3, class: 't-num' });
    t.textContent = n;
    g.appendChild(t);
    terr.appendChild(g);
  }
  svg.appendChild(terr);

  // fronteras internas de capítulo: río o cordillera (contiguas, no separan por mar)
  const dividers = svgEl('g', { id: 'dividers' });
  for (const cb of (MAP.chapterBorders || [])) {
    if (cb.style === 'river') {
      dividers.appendChild(svgEl('path', { d: cb.path, class: 'chapter-river', title: cb.name }));
    } else {
      dividers.appendChild(svgEl('path', { d: cb.path, class: 'chapter-mountains', 'marker-mid': 'url(#mtnPeak)', title: cb.name }));
    }
  }
  svg.appendChild(dividers);

  // emblema grande de cada reino (título), en el centro de su región
  const labels = svgEl('g', { id: 'labels' });
  for (const t of TITULOS) {
    const arts = artsOfTitulo(t.id);
    let sx = 0, sy = 0; for (const n of arts) { sx += MAP.art.center[n][0]; sy += MAP.art.center[n][1]; }
    const c = [sx / arts.length, sy / arts.length];
    const g = svgEl('g', { class: 'clabel', 'data-tid': t.id });
    g.appendChild(svgEl('circle', { cx: c[0], cy: c[1], r: 36, class: 'emblem-bg' }));
    const em = svgEl('text', { x: c[0], y: c[1], class: 'c-emblem' });
    em.textContent = MAP.titulos[t.id].emblem || t.emblem || t.faction.unit;
    g.appendChild(em);
    labels.appendChild(g);
  }
  svg.appendChild(labels);

  installZoomPan(svg);
  refreshMap();
}

// coloca la guarnición sobre la isla, encima del cluster
function metaLabelDy(islandId) {
  const arts = MAP.islands[islandId].arts;
  let minY = Infinity;
  for (const n of arts) minY = Math.min(minY, MAP.art.center[n][1]);
  return MAP.islands[islandId].center[1] - minY + 22;
}

function refreshMap() {
  for (let n = 1; n <= 169; n++) {
    const g = document.querySelector(`.terr[data-n="${n}"]`); if (!g) continue;
    const st = statusOf(n);
    const tid = MAP.art.titulo[n]; const col = MAP.titulos[tid].color;
    const besieged = st === 'owned' && memoryOf(tid) < MEMORY_DANGER;
    g.classList.toggle('owned', st === 'owned');
    g.classList.toggle('attackable', st === 'attackable');
    g.classList.toggle('locked', st === 'locked');
    g.classList.toggle('besieged', besieged);
    const land = g.querySelector('.land');
    if (st === 'owned') { land.style.fill = besieged ? darken(col, 0.15) : col; land.style.stroke = 'rgba(255,255,255,.65)'; }
    else if (st === 'attackable') { land.style.fill = darken(col, 0.5); land.style.stroke = '#e3c07a'; }
    else { land.style.fill = darken(col, 0.8); land.style.stroke = darken(col, 0.55); }
  }
  // rutas
  document.querySelectorAll('.sea-route').forEach((r) => {
    const a = +r.getAttribute('data-a'), b = +r.getAttribute('data-b');
    r.classList.toggle('lit', !!S.owned[a] !== !!S.owned[b]);
    r.classList.toggle('owned', !!S.owned[a] && !!S.owned[b]);
  });
  // progreso global
  const owned = Object.keys(S.owned).filter((k) => S.owned[k]).length;
  $('progressLabel').textContent = `Territorios: ${owned}/169`;
  $('terrFill').style.width = `${(owned / 169) * 100}%`;
  const besiegedT = TITULOS.filter((t) => artsOfTitulo(t.id).some((n) => S.owned[n]) && memoryOf(t.id) < MEMORY_DANGER);
  $('hintText').textContent = besiegedT.length
    ? `🌫️ El Olvido asedia ${besiegedT.length} título(s). ¡Defiéndelos!`
    : 'Rueda para hacer zoom · arrastra para mover · pulsa un territorio con brillo dorado ⚔️';
  renderLegend();
}

/* ── zoom / pan (solo el mapa) ── */
function applyView() { $('map').setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); }
function clampView() {
  const minW = 260, maxW = WORLD.w * 1.25;
  view.w = Math.max(minW, Math.min(maxW, view.w));
  view.h = view.w * (WORLD.h / WORLD.w);
  const margin = 300;
  view.x = Math.max(-margin, Math.min(WORLD.w + margin - view.w, view.x));
  view.y = Math.max(-margin, Math.min(WORLD.h + margin - view.h, view.y));
}
function zoomAt(sx, sy, factor) {
  const svg = $('map'); const r = svg.getBoundingClientRect();
  const wx = view.x + (sx - r.left) / r.width * view.w;
  const wy = view.y + (sy - r.top) / r.height * view.h;
  view.w *= factor; clampView();
  const r2 = { w: view.w, h: view.h };
  view.x = wx - (sx - r.left) / r.width * r2.w;
  view.y = wy - (sy - r.top) / r.height * r2.h;
  clampView(); applyView();
}
function installZoomPan(svg) {
  let panning = false, moved = 0, lastX = 0, lastY = 0, downN = null;
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });
  svg.addEventListener('pointerdown', (e) => {
    panning = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    const el = e.target.closest('.terr'); downN = el ? +el.getAttribute('data-n') : null;
    try { svg.setPointerCapture(e.pointerId); } catch { /* táctil/sintético */ }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!panning) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    const r = svg.getBoundingClientRect();
    view.x -= dx / r.width * view.w; view.y -= dy / r.height * view.h;
    clampView(); applyView();
  });
  svg.addEventListener('pointerup', (e) => {
    panning = false;
    if (moved < 6 && downN != null) onArticleClick(downN);
    downN = null;
  });
  $('zoomIn').addEventListener('click', () => { const r = $('map').getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.8); });
  $('zoomOut').addEventListener('click', () => { const r = $('map').getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25); });
  $('zoomReset').addEventListener('click', () => { view = { x: 0, y: 0, w: WORLD.w, h: WORLD.h }; clampView(); applyView(); });
}

/* ── centrar el mapa en un artículo (al abrir su ficha) ── */
function focusArticle(n, targetW) {
  const c = MAP.art.center[n];
  view.w = targetW || Math.min(view.w, 620); clampView();
  view.x = c[0] - view.w / 2; view.y = c[1] - view.h / 2; clampView(); applyView();
}

/* ───────────────────────── HUD + leyenda ───────────────────────── */

function renderHud() {
  $('hudScore').textContent = fmt(S.score);
  $('hudCombo').textContent = `×${comboMult().toFixed(2).replace(/\.?0+$/, '')}`;
  $('comboChip').classList.toggle('hot', combo >= 2);
  $('hudStreak').textContent = S.daily.streak;
  const lvl = levelFromXp(S.xp);
  $('hudLevel').textContent = `Nv. ${lvl}`; $('hudRank').textContent = rankFor(lvl);
  const prev = lvl > 1 ? xpNeed(lvl - 1) : 0;
  $('xpFill').style.width = `${Math.max(2, Math.min(100, (S.xp - prev) / (xpNeed(lvl) - prev) * 100))}%`;
  $('btnSound').textContent = S.sound ? '🔊' : '🔇';
  const pb = $('prestigeBadge'); pb.hidden = S.prestige === 0;
  if (S.prestige > 0) pb.textContent = `⭐ Legislatura ${['II', 'III', 'IV', 'V', 'VI'][Math.min(S.prestige - 1, 4)]} · ×${(1 + 0.5 * S.prestige).toFixed(1)}`;
}

function renderLegend() {
  const box = $('legendList'); if (!box) return;
  box.innerHTML = TITULOS.map((t) => {
    const arts = artsOfTitulo(t.id); const owned = arts.filter((n) => S.owned[n]).length;
    const done = owned === arts.length;
    const bes = arts.some((n) => S.owned[n]) && memoryOf(t.id) < MEMORY_DANGER;
    const divIcon = t.island ? '🏝️' : t.chapterDivider === 'river' ? '🌊' : t.chapterDivider === 'mountains' ? '⛰️' : '';
    const emblem = MAP.titulos[t.id].emblem || t.emblem || t.faction.unit;
    return `<button class="leg-row ${done ? 'done' : ''}" data-tid="${t.id}" title="${t.theme}${t.chapterDivider ? ` (dividido por ${t.dividerName})` : ''}">
      <span class="leg-emblem" style="background:${t.color}">${emblem}</span>
      <span class="leg-name">${t.roman ? t.roman + '. ' : ''}${t.name}</span>
      <span class="leg-prog">${divIcon ? divIcon + ' ' : ''}${bes ? '🌫️ ' : ''}${owned}/${arts.length}${done ? ' ✓' : ''}</span>
    </button>`;
  }).join('');
  box.querySelectorAll('.leg-row').forEach((b) => b.addEventListener('click', () => {
    const tid = b.dataset.tid; const arts = artsOfTitulo(tid);
    // centrar en el primer artículo atacable o el primero del título
    const target = arts.find((n) => statusOf(n) === 'attackable') || arts.find((n) => !S.owned[n]) || arts[0];
    focusArticle(target, 700);
    sfx.click();
  }));
}

/* ───────────────────────── Escudo pictórico del artículo ─────────────────────────
   Una única imagen: un escudo heráldico con el color del reino y el símbolo
   que representa la palabra clave del artículo (primer emoji de su escena). */
function crestSVG(emoji, color) {
  const id = 'cg' + Math.random().toString(36).slice(2, 8);
  const top = lighten(color, 0.30), bot = darken(color, 0.30);
  return `<svg class="crest" viewBox="0 0 100 116" role="img" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient></defs>
    <path class="crest-shield" d="M50 4 L94 18 L94 54 Q94 92 50 112 Q6 92 6 54 L6 18 Z" fill="url(#${id})"/>
    <path class="crest-inner" d="M50 12 L88 24 L88 54 Q88 86 50 103 Q12 86 12 54 L12 24 Z" fill="none"/>
    <text class="crest-emoji" x="50" y="54" text-anchor="middle" dominant-baseline="central">${emoji}</text>
  </svg>`;
}
function sceneHTML(a, n) {
  const col = (n && MAP.art.titulo[n]) ? MAP.titulos[MAP.art.titulo[n]].color : '#8a93a8';
  const emoji = (a.img && a.img[0]) || '📜';
  return `<div class="crest-wrap">${crestSVG(emoji, col)}</div>`;
}

/* ───────────────────────── Preparación (profesor) ───────────────────────── */
let PREP = null;
function startPrep(islandId) {
  closeAll();
  const meta = MAP.islands[islandId]; const t = tituloById(meta.tituloId);
  PREP = { islandId, i: 0, arts: meta.arts.slice(), tid: t.id };   // meta.arts ya viene expandido
  $('prepColor').style.setProperty('--tc', t.color);
  $('prepProfEmoji').textContent = t.prof.emoji;
  $('prepProfName').textContent = t.prof.name;
  $('prepFaction').textContent = meta.name;
  $('prep').hidden = false; renderPrepCard();
}
function renderPrepCard() {
  const a = ARTICLES[PREP.arts[PREP.i]]; const total = PREP.arts.length; const num = PREP.arts[PREP.i];
  $('prepProgress').textContent = `Artículo ${PREP.i + 1} de ${total}`;
  $('prepDots').innerHTML = PREP.arts.map((_, i) => `<span class="pdot ${i === PREP.i ? 'on' : ''} ${i < PREP.i ? 'seen' : ''}"></span>`).join('');
  $('prepArtNum').textContent = `Art. ${num}`;
  $('prepArtTitle').textContent = a.t;
  $('prepScene').innerHTML = sceneHTML(a, num);
  $('prepExp').textContent = a.e;
  $('prepSpeak').hidden = !S.voice; stopVoice();
  $('prepMnemo').innerHTML = `<span class="mnemo-tag">💡 Truco para recordarlo</span>${a.mn}`;
  $('prepPrev').disabled = PREP.i === 0;
  const last = PREP.i === total - 1;
  $('prepNext').textContent = last ? '¡Listo! ⚔️' : 'Siguiente ➜';
  $('prepNext').classList.toggle('ready', last);
}
function prepStep(d) {
  sfx.page(); const total = PREP.arts.length;
  if (d > 0 && PREP.i === total - 1) {
    if (!S.prepared[PREP.islandId]) { S.stats.prepared++; unlock('prepared'); }
    S.prepared[PREP.islandId] = true; save();
    const first = PREP.arts.find((n) => statusOf(n) === 'attackable') || PREP.arts[0];
    PREP = null; $('prep').hidden = true; openPreBattle(first);
    return;
  }
  PREP.i = Math.max(0, Math.min(total - 1, PREP.i + d)); renderPrepCard();
}

/* ───────────────────────── Batalla (1 pregunta = 1 territorio) ───────────────────────── */
let B = null, timerId = null;
function startBattle(mode, arts) {
  closeAll();
  B = { mode, arts, i: 0, answered: false, qStart: 0, earned: 0, correct: 0 };
  $('battle').hidden = false; askQuestion();
}
function askQuestion() {
  stopVoice();
  const n = B.arts[B.i]; const a = ARTICLES[n]; const tid = MAP.art.titulo[n]; const t = tituloById(tid);
  B.n = n; B.a = a; B.answered = false;
  const order = shuffle(a.o.map((_, i) => i)); B.correctBtn = order.indexOf(a.c);
  $('bIcon').textContent = t.faction.unit;
  $('bTitulo').textContent = `${t.roman ? t.roman + '. ' : ''}${t.name}`;
  $('bMode').textContent = B.mode === 'attack' ? '⚔️ Conquista' : B.mode === 'defense' ? '🛡️ Defensa' : '📖 Repaso';
  $('bArtLabel').textContent = `Art. ${n} · ${a.t}`;
  $('bScene').innerHTML = sceneHTML(a, n);
  $('qText').textContent = a.q;
  const box = $('qOptions'); box.innerHTML = '';
  order.forEach((oi, i) => { const btn = document.createElement('button'); btn.className = 'q-opt'; btn.innerHTML = `<span class="k">${i + 1}</span><span>${a.o[oi]}</span>`; btn.addEventListener('click', () => answer(i)); box.appendChild(btn); });
  if (B.arts.length > 1) { $('bProgress').hidden = false; $('bProgress').innerHTML = B.arts.map((_, i) => `<span class="pip ${i < B.i ? 'done' : i === B.i ? 'cur' : ''}"></span>`).join(''); }
  else $('bProgress').hidden = true;
  $('qFeedback').hidden = true; startTimer(); B.qStart = Date.now();
}
function startTimer() {
  stopTimer(); const fill = $('timerFill'); fill.className = ''; const t0 = Date.now(); const QS = qSeconds();
  timerId = setInterval(() => {
    const left = QS - (Date.now() - t0) / 1000; const pct = Math.max(0, left / QS * 100);
    fill.style.width = `${pct}%`; fill.className = pct < 20 ? 'crit' : pct < 45 ? 'warn' : '';
    if (left <= 5.2 && left > 5.0) sfx.tick();
    if (left <= 0) { stopTimer(); answer(-1); }
  }, 100);
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

function answer(btnIdx) {
  if (!B || B.answered) return; B.answered = true; stopTimer();
  const secs = (Date.now() - B.qStart) / 1000; const remaining = Math.max(0, qSeconds() - secs);
  const correct = btnIdx === B.correctBtn; const opts = $('qOptions').children;
  for (const o of opts) o.disabled = true;
  S.stats.answers++;
  const banner = $('fbBanner');
  if (correct) {
    S.stats.correct++; combo++; S.bestCombo = Math.max(S.bestCombo, combo);
    if (combo >= 5) unlock('combo5'); if (combo >= 10) unlock('combo10'); if (combo >= 20) unlock('combo20');
    if (secs < 4) unlock('flash'); if (S.stats.correct >= 169) unlock('sabio');
    if (S.stats.fastest === null || secs < S.stats.fastest) S.stats.fastest = secs;
    const mf = B.mode === 'attack' ? 1 : B.mode === 'defense' ? 1.4 : 0.6;
    const pts = Math.round((BASE_POINTS + remaining * TIME_BONUS_PER_S) * comboMult() * globalMult() * mf);
    B.earned += pts; B.correct++; S.score += pts; addXp(pts);
    if (B.mode === 'attack') conquer(B.n);
    else refreshMemory(MAP.art.titulo[B.n]);
    opts[btnIdx].classList.add('correct');
    banner.className = 'fb-banner ok';
    banner.innerHTML = `<span>✅ ¡Correcto!${combo >= 2 ? ` 🔥 ×${comboMult().toFixed(2).replace(/\.?0+$/, '')}` : ''}</span><span class="pts">+${fmt(pts)} pts</span>`;
    sfx.correct(); bump($('hudScore'));
  } else {
    combo = 0; if (btnIdx >= 0) opts[btnIdx].classList.add('wrong');
    opts[B.correctBtn].classList.add('correct');
    for (const o of opts) if (!o.classList.contains('correct') && !o.classList.contains('wrong')) o.classList.add('faded');
    banner.className = 'fb-banner ko';
    banner.innerHTML = `<span>${btnIdx < 0 ? '⏰ ¡Tiempo agotado!' : '❌ Incorrecto'}</span>`;
    sfx.wrong();
  }
  $('fbRef').textContent = `📜 Art. ${B.n} CE · ${B.a.t}`;
  $('fbExp').textContent = B.a.e;
  $('fbSpeak').hidden = !S.voice;
  $('fbMnemo').innerHTML = `💡 ${B.a.mn}`;
  $('qFeedback').hidden = false; renderHud(); refreshMap(); save();
  const last = B.i >= B.arts.length - 1;
  $('btnNext').textContent = last ? 'Terminar' : (B.mode === 'defense' && !correct ? 'Ver resultado…' : 'Siguiente ➜');
  $('btnNext').focus();
}
function nextStep() {
  if (!B) return;
  // defensa: un fallo la pierde
  if (B.mode === 'defense' && $('fbBanner').classList.contains('ko')) return endBattle(false);
  if (B.i >= B.arts.length - 1) return endBattle(true);
  B.i++; askQuestion();
}

function conquer(n) {
  S.owned[n] = true; S.stats.conquests++; const tid = MAP.art.titulo[n]; refreshMemory(tid);
  unlock('first');
  const c = MAP.art.center[n];
  if (tituloConquered(tid)) {
    const t = tituloById(tid);
    const bonus = Math.round(400 * artsOfTitulo(tid).length / 4 * globalMult());
    S.score += bonus; addXp(bonus);
    unlock('cont1'); if (t.islands.length > 1) unlock('archi'); if (tid === 't1') unlock('derechos');
    toast(`🏛️ ¡${t.name} conquistado! +${fmt(bonus)} pts`, 'ach-toast'); confetti();
    if (TITULOS.every((x) => tituloConquered(x.id))) { unlock('mapa'); setTimeout(showVictory, 600); }
  }
}

function endBattle(won) {
  stopTimer(); $('battle').hidden = true;
  const rows = []; let emoji, title, sub;
  if (B.mode === 'attack') {
    // en conquista, cada acierto ya conquistó su territorio; el "fin" es informativo
    emoji = B.correct > 0 ? '🎉' : '🛡️'; title = B.correct > 0 ? '¡Territorio conquistado!' : 'Territorio resistió';
    sub = B.correct > 0 ? `Art. ${B.n} es tuyo. Sigue expandiéndote por el mapa.` : `Fallaste el art. ${B.n}. Estudia con su profesor y vuelve a intentarlo.`;
  } else if (B.mode === 'defense') {
    if (won) { const tid = MAP.art.titulo[B.arts[0]]; refreshMemory(tid); S.stats.defenses++; unlock('defender'); emoji = '🛡️'; title = '¡Título defendido!'; sub = 'El Olvido se retira. Memoria restaurada al 100 %.'; sfx.conquest(); }
    else { const tid = MAP.art.titulo[B.arts[0]]; forgetSome(tid); emoji = '🌫️'; title = 'El Olvido avanza…'; sub = 'Has perdido algunos territorios de este título. Reconquístalos.'; sfx.defeat(); }
  } else { emoji = '📖'; title = 'Repaso completado'; sub = 'Memoria del título restaurada.'; refreshMemory(MAP.art.titulo[B.arts[0]]); }
  rows.push(['Aciertos', `${B.correct}/${B.arts.length}`]);
  rows.push(['Puntos ganados', `+${fmt(B.earned)}`]);
  $('endEmoji').textContent = emoji; $('endTitle').textContent = title; $('endSub').textContent = sub;
  $('endBreakdown').innerHTML = rows.map((r, i) => `<div class="row ${i === rows.length - 1 ? 'total' : ''}"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  const retry = $('btnEndRetry');
  if (B.mode === 'attack' && B.correct === 0) { retry.hidden = false; retry.dataset.island = MAP.art.island[B.n]; }
  else retry.hidden = true;
  $('battleEnd').hidden = false; B = null; renderHud(); refreshMap(); save();
}

function forgetSome(tid) {
  const owned = artsOfTitulo(tid).filter((n) => S.owned[n] && n !== 1);
  const lose = shuffle(owned).slice(0, Math.min(3, owned.length));
  for (const n of lose) delete S.owned[n];
  refreshMemory(tid);
}

/* ───────────────────────── Ficha previa ───────────────────────── */
function openPreBattle(n) {
  closeAll(); focusArticle(n);
  const a = ARTICLES[n]; const tid = MAP.art.titulo[n]; const t = tituloById(tid); const islandId = MAP.art.island[n];
  const meta = MAP.islands[islandId]; const st = statusOf(n);
  $('pbIcon').textContent = t.faction.unit;
  $('pbName').textContent = `Art. ${n} · ${a.t}`;
  $('pbArts').textContent = `${t.roman ? t.roman + '. ' : ''}${t.name}${t.islands.length > 1 ? ' · ' + meta.name : ''}`;
  $('pbFaction').innerHTML = `<span class="faction-badge" style="--tc:${t.color}">${t.faction.unit} ${t.faction.name}</span>`;
  $('pbScene').innerHTML = sceneHTML(a, n);
  const actions = $('pbActions'); actions.innerHTML = '';
  const prepared = S.prepared[islandId];

  if (st === 'attackable') {
    $('pbDesc').textContent = `Territorio enemigo. Responde su pregunta para conquistarlo.`;
    $('pbMeta').innerHTML = `<span class="meta-chip">⏱️ ${qSeconds()}s</span><span class="meta-chip">${prepared ? '🎓 Preparado' : '📖 Sin preparar'}</span>`;
    const prep = document.createElement('button'); prep.className = prepared ? 'secondary-btn' : 'primary-btn';
    prep.innerHTML = `🎓 ${prepared ? 'Repasar' : 'Prepararme'} · ${meta.name}`;
    prep.addEventListener('click', () => startPrep(islandId)); actions.appendChild(prep);
    const atk = document.createElement('button'); atk.className = prepared ? 'primary-btn' : 'secondary-btn';
    atk.innerHTML = '⚔️ ¡Conquistar!'; atk.addEventListener('click', () => startBattle('attack', [n])); actions.appendChild(atk);
    if (!prepared) { const tip = document.createElement('p'); tip.className = 'pb-tip'; tip.textContent = `💡 ${t.prof.motto}`; actions.appendChild(tip); }
  } else if (st === 'owned') {
    const mem = memoryOf(tid); const danger = mem < MEMORY_DANGER;
    $('pbDesc').textContent = danger ? '🌫️ El Olvido asedia este título. Defiéndelo o perderás territorios.' : 'Territorio tuyo. Repásalo para mantener la memoria.';
    $('pbMeta').innerHTML = `<span class="meta-chip">🧠 Memoria del título: ${Math.round(mem)}%</span>`;
    const prep = document.createElement('button'); prep.className = 'secondary-btn'; prep.innerHTML = `🎓 Estudiar · ${meta.name}`;
    prep.addEventListener('click', () => startPrep(islandId)); actions.appendChild(prep);
    const ownedArts = artsOfTitulo(tid).filter((x) => S.owned[x]);
    const b = document.createElement('button'); b.className = 'primary-btn';
    if (danger) { b.innerHTML = '🛡️ ¡Defender el título!'; b.addEventListener('click', () => startBattle('defense', shuffle(ownedArts).slice(0, Math.min(4, ownedArts.length)))); }
    else { b.innerHTML = '📖 Repaso rápido'; b.addEventListener('click', () => startBattle('review', shuffle(ownedArts).slice(0, Math.min(3, ownedArts.length)))); }
    actions.appendChild(b);
  }
  $('preBattle').hidden = false;
}

function onArticleClick(n) {
  sfx.click(); const st = statusOf(n);
  if (st === 'locked') {
    const g = document.querySelector(`.terr[data-n="${n}"]`); g.classList.remove('shake'); void g.getBoundingClientRect(); g.classList.add('shake');
    toast('🔒 Conquista antes un territorio vecino para llegar hasta aquí.', 'danger'); return;
  }
  openPreBattle(n);
}

/* ───────────────────────── Renta / confeti / victoria ───────────────────────── */
function incomeTick() {
  if (document.hidden || !$('battle').hidden || !$('prep').hidden) return;
  let gain = 0;
  for (const t of TITULOS) if (memoryOf(t.id) >= MEMORY_DANGER) gain += artsOfTitulo(t.id).filter((n) => S.owned[n]).length;
  gain = Math.round(gain * 0.3 * globalMult());
  if (gain > 0) { S.score += gain; renderHud(); const w = $('mapWrap').getBoundingClientRect(); floater(`+${gain} 🏳️`, w.width - 120, 20); save(); }
  // El Olvido: si un título llega a memoria 0, pierde algunos territorios
  for (const t of TITULOS) if (artsOfTitulo(t.id).some((n) => S.owned[n]) && memoryOf(t.id) <= 0) { forgetSome(t.id); toast(`🌫️ El Olvido tomó territorios de ${t.name}`, 'danger'); refreshMap(); }
  // Dificultad difícil: pierdes 1 territorio por cada hora jugada
  const every = diff().loseEveryMin;
  if (every > 0) {
    const owned = Object.keys(S.owned).filter((k) => S.owned[k] && +k !== 1);
    while (owned.length && Date.now() - S.lastLossTs >= every * 60000) {
      const n = +owned.splice(Math.floor(Math.random() * owned.length), 1)[0];
      delete S.owned[n]; S.lastLossTs += every * 60000;
      toast(`🔥 Perdiste el territorio del art. ${n} (dificultad Difícil).`, 'danger');
      refreshMap(); save();
    }
    if (!owned.length) S.lastLossTs = Date.now();
  } else { S.lastLossTs = Date.now(); }
}
function fmtDuration(ms) {
  const s = Math.floor((ms || 0) / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min ${sec} s`;
  return `${sec} s`;
}
/* contador de tiempo de juego (solo mientras la pestaña está visible) */
let lastPlayTs = Date.now();
function playTick() { const now = Date.now(); if (!document.hidden) S.stats.playMs = (S.stats.playMs || 0) + (now - lastPlayTs); lastPlayTs = now; }
function confetti() {
  const canvas = $('confetti'); const ctx = canvas.getContext('2d'); canvas.width = innerWidth; canvas.height = innerHeight;
  const colors = ['#c60b1e', '#ffc400', '#e3a93f', '#fff', '#3fbf6f', '#b48cff'];
  const parts = Array.from({ length: 160 }, () => ({ x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height * .4, vx: (Math.random() - .5) * 3, vy: 2.5 + Math.random() * 4, size: 5 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)], rot: Math.random() * Math.PI, vr: (Math.random() - .5) * .25 }));
  const t0 = Date.now();
  (function frame() { ctx.clearRect(0, 0, canvas.width, canvas.height); for (const p of parts) { p.x += p.vx; p.y += p.vy; p.rot += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .6); ctx.restore(); } if (Date.now() - t0 < 2600) requestAnimationFrame(frame); else ctx.clearRect(0, 0, canvas.width, canvas.height); })();
}
function showVictory() {
  $('victoryStats').innerHTML = `
    <div class="row"><span>Puntuación</span><b>${fmt(S.score)} pts</b></div>
    <div class="row"><span>Tiempo en conquistarlo todo</span><b>${fmtDuration(S.stats.playMs)}</b></div>
    <div class="row"><span>Dificultad</span><b>${diff().emoji} ${diff().name}</b></div>
    <div class="row"><span>Mejor combo</span><b>×${S.bestCombo}</b></div>
    <div class="row"><span>Aciertos</span><b>${S.stats.correct}/${S.stats.answers}</b></div>
    <div class="row total"><span>Rango</span><b>${rankFor(levelFromXp(S.xp))}</b></div>`;
  $('btnPrestige').textContent = `🏛️ Nueva legislatura (×${(1 + 0.5 * (S.prestige + 1)).toFixed(1)})`;
  $('victoryModal').hidden = false; confetti(); sfx.conquest();
}
function prestige() {
  S.prestige++; S.owned = { 1: true }; S.prepared = {}; for (const t of TITULOS) S.mem[t.id] = Date.now();
  save(); closeAll(); refreshMap(); renderHud();
  toast(`⭐ Nueva legislatura: puntos ×${(1 + 0.5 * S.prestige).toFixed(1)}. ¡Reconquista el mundo!`);
}

/* ───────────────────────── Modales ───────────────────────── */
function closeAll() { stopVoice(); for (const id of ['preBattle', 'battleEnd', 'achModal', 'statsModal', 'settingsModal', 'indexModal', 'introModal', 'victoryModal', 'prep']) $(id).hidden = true; }
function showAchievements() {
  $('achList').innerHTML = ACHIEVEMENTS.map((a) => { const g = S.ach.includes(a.id); return `<div class="ach ${g ? '' : 'locked'}"><span class="a-icon">${g ? a.icon : '🔒'}</span><div><div class="a-name">${a.name}</div><div class="a-desc">${a.desc}</div></div><span class="a-pts">${g ? '✓ ' : ''}+${a.pts}</span></div>`; }).join('');
  $('achModal').hidden = false;
}
function showStats() {
  const acc = S.stats.answers ? Math.round(S.stats.correct / S.stats.answers * 100) : 0;
  const conts = TITULOS.filter((t) => tituloConquered(t.id)).length;
  const boxes = [
    [fmt(S.score), 'Puntos'], [`Nv. ${levelFromXp(S.xp)}`, rankFor(levelFromXp(S.xp))],
    [`${Object.keys(S.owned).filter((k) => S.owned[k]).length}/169`, 'Territorios'],
    [`${conts}/11`, 'Títulos completos'],
    [`${S.stats.correct}/${S.stats.answers} (${acc}%)`, 'Aciertos'], [`×${S.bestCombo}`, 'Mejor combo'],
    [S.stats.defenses, 'Defensas'], [S.stats.fastest ? `${S.stats.fastest.toFixed(1)}s` : '—', 'Más rápida'],
    [`${S.daily.streak} día(s)`, 'Racha'], [`${S.ach.length}/${ACHIEVEMENTS.length}`, 'Logros'],
    [fmtDuration(S.stats.playMs), 'Tiempo de juego'], [`${diff().emoji} ${diff().name}`, 'Dificultad'],
  ];
  $('statsList').innerHTML = boxes.map(([v, l]) => `<div class="stat-box"><div class="s-val">${v}</div><div class="s-lbl">${l}</div></div>`).join('');
  $('statsModal').hidden = false;
}

/* ───────────────────────── Índice desplegable (títulos → capítulos → artículos) ───────────────────────── */
function renderIndex() {
  const tree = $('indexTree'); if (!tree) return;
  tree.innerHTML = TITULOS.map((t) => {
    const arts = artsOfTitulo(t.id); const owned = arts.filter((n) => S.owned[n]).length;
    const emblem = MAP.titulos[t.id].emblem || t.emblem || t.faction.unit;
    const multi = t.islands.length > 1;
    const body = t.islands.map((is) => {
      const rows = MAP.islands[is.id].arts.map((n) => {
        const a = ARTICLES[n]; const st = statusOf(n);
        const ic = st === 'owned' ? '✅' : st === 'attackable' ? '⚔️' : '🔒';
        return `<button class="ix-art ${st}" data-n="${n}">
          <span class="ix-emoji">${(a.img && a.img[0]) || '📜'}</span>
          <span class="ix-n">Art. ${n}</span>
          <span class="ix-t">${a.t}</span>
          <span class="ix-st">${ic}</span></button>`;
      }).join('');
      return (multi ? `<div class="ix-cap">${is.name}</div>` : '') + rows;
    }).join('');
    return `<details class="ix-titulo" ${owned > 0 ? 'open' : ''}>
      <summary><span class="ix-emblem" style="background:${t.color}">${emblem}</span>
        <span class="ix-tname">${t.roman ? t.roman + '. ' : ''}${t.name}</span>
        <span class="ix-prog">${owned}/${arts.length}</span></summary>
      <div class="ix-body">${body}</div></details>`;
  }).join('');
  tree.querySelectorAll('.ix-art').forEach((b) => b.addEventListener('click', () => {
    const n = +b.dataset.n; $('indexModal').hidden = true; sfx.click();
    focusArticle(n, 520);
    if (statusOf(n) !== 'locked') openPreBattle(n);
  }));
}

/* ───────────────────────── Ajustes (dificultad, música, efectos, voz) ───────────────────────── */
function renderSettings() {
  const box = $('settingsBody'); if (!box) return;
  const diffBtns = Object.entries(DIFFICULTIES).map(([k, d]) =>
    `<button class="diff-opt ${S.difficulty === k ? 'sel' : ''}" data-diff="${k}">
       <span class="diff-emoji">${d.emoji}</span>
       <span class="diff-txt"><b>${d.name}</b><small>${d.desc}</small></span>
       <span class="diff-check">${S.difficulty === k ? '✓' : ''}</span></button>`).join('');
  const toggle = (id, on, label, desc, icon) =>
    `<button class="set-toggle ${on ? 'on' : ''}" data-toggle="${id}">
       <span class="st-icon">${icon}</span>
       <span class="st-txt"><b>${label}</b><small>${desc}</small></span>
       <span class="st-sw"><span class="st-knob"></span></span></button>`;
  box.innerHTML = `
    <div class="set-section"><h3>⚔️ Dificultad</h3><div class="diff-opts">${diffBtns}</div></div>
    <div class="set-section"><h3>🎵 Audio y voz</h3>
      ${toggle('music', S.music, 'Música', 'Marcha épica de fondo, estilo napoleónico.', '🎼')}
      ${toggle('sound', S.sound, 'Efectos de sonido', 'Aciertos, fallos y conquistas.', '🔊')}
      ${toggle('voice', S.voice, 'Voz del artículo', 'Botón 🗣️ para escuchar la explicación en voz alta.', '🗣️')}
    </div>`;
  box.querySelectorAll('.diff-opt').forEach((b) => b.addEventListener('click', () => {
    S.difficulty = b.dataset.diff; S.lastLossTs = Date.now(); save();
    renderSettings(); refreshMap(); toast(`${diff().emoji} Dificultad: ${diff().name}`); sfx.click();
  }));
  box.querySelectorAll('.set-toggle').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.toggle; S[id] = !S[id]; save(); renderSettings(); renderHud();
    if (id === 'music') { S.music ? startMusic() : stopMusic(); }
    if (id === 'voice' && !S.voice) stopVoice();
    sfx.click();
  }));
}

/* ───────────────────────── Init ───────────────────────── */
function init() {
  buildMap(); renderHud(); checkDaily();
  $('btnAch').addEventListener('click', () => { closeAll(); showAchievements(); });
  $('btnStats').addEventListener('click', () => { closeAll(); showStats(); });
  $('btnIndex').addEventListener('click', () => { closeAll(); renderIndex(); $('indexModal').hidden = false; });
  $('btnSettings').addEventListener('click', () => { closeAll(); renderSettings(); $('settingsModal').hidden = false; });
  $('prepSpeak').addEventListener('click', () => { if (PREP) speakArticle(PREP.arts[PREP.i]); });
  $('fbSpeak').addEventListener('click', () => { if (B) speakArticle(B.n); });
  $('btnHelp').addEventListener('click', () => { closeAll(); $('introModal').hidden = false; });
  $('btnSound').addEventListener('click', () => { S.sound = !S.sound; renderHud(); save(); });
  $('btnIntroOk').addEventListener('click', () => { S.seenIntro = true; save(); $('introModal').hidden = true; sfx.click(); });
  $('prepPrev').addEventListener('click', () => prepStep(-1));
  $('prepNext').addEventListener('click', () => prepStep(1));
  $('prepSkip').addEventListener('click', () => { const first = PREP.arts[0]; PREP = null; $('prep').hidden = true; openPreBattle(first); });
  $('btnNext').addEventListener('click', nextStep);
  $('bFlee').addEventListener('click', () => { if (B) endBattle(B.correct > 0); });
  $('btnEndOk').addEventListener('click', () => { $('battleEnd').hidden = true; });
  $('btnEndRetry').addEventListener('click', () => { const isl = $('btnEndRetry').dataset.island; $('battleEnd').hidden = true; startPrep(isl); });
  $('btnPrestige').addEventListener('click', prestige);
  $('btnVictoryStay').addEventListener('click', () => { $('victoryModal').hidden = true; });
  $('btnReset').addEventListener('click', () => { if (confirm('¿Seguro? Se borrará toda la partida.')) { localStorage.removeItem(SAVE_KEY); location.reload(); } });
  $('legendToggle').addEventListener('click', () => { $('legendPanel').classList.toggle('open'); });
  document.querySelectorAll('.card-close').forEach((b) => b.addEventListener('click', () => { $(b.dataset.close).hidden = true; }));
  document.addEventListener('keydown', (e) => {
    if (!$('battle').hidden && B && !B.answered && e.key >= '1' && e.key <= '4') { const i = +e.key - 1; if ($('qOptions').children[i]) answer(i); }
    else if (!$('battle').hidden && B && B.answered && e.key === 'Enter') nextStep();
    else if (!$('prep').hidden && PREP) { if (e.key === 'ArrowRight' || e.key === 'Enter') prepStep(1); else if (e.key === 'ArrowLeft') prepStep(-1); }
  });
  setInterval(incomeTick, INCOME_TICK_MS);
  setInterval(refreshMap, 30000);
  // tiempo de juego (solo con la pestaña visible)
  lastPlayTs = Date.now();
  setInterval(playTick, 1000);
  document.addEventListener('visibilitychange', () => { lastPlayTs = Date.now(); });
  window.addEventListener('beforeunload', () => { playTick(); stopVoice(); save(); });
  // música: arranca al primer gesto del usuario si está activada (autoplay bloqueado sin gesto)
  if (S.music) {
    const kick = () => { if (S.music) startMusic(); document.removeEventListener('pointerdown', kick); };
    document.addEventListener('pointerdown', kick);
  }
  const params = new URLSearchParams(location.search);
  if (!S.seenIntro && !params.has('nointro')) $('introModal').hidden = false;
  const bes = TITULOS.filter((t) => artsOfTitulo(t.id).some((n) => S.owned[n]) && memoryOf(t.id) < MEMORY_DANGER);
  if (bes.length) setTimeout(() => toast(`🌫️ El Olvido asedia ${bes.length} título(s). ¡Defiéndelos!`, 'danger'), 800);
}
document.addEventListener('DOMContentLoaded', init);
