/* =========================================================================
   CONQUISTA LA CONSTITUCIÓN — motor del juego
   Continente "Constitucia": mapa tipo Risk sobre la CE de 1978.
   Cada territorio cubre un bloque de artículos; su superficie es proporcional
   al nº de artículos. Se conquista respondiendo UNA pregunta por artículo
   sin fallar ninguna. Modo preparación con un profesor por territorio.
   Sin dependencias. Guardado en localStorage.
   ========================================================================= */

'use strict';

/* ───────────────────────── Constantes ───────────────────────── */

const SAVE_KEY = 'ce78_conquista_v2';
const QUESTION_SECONDS = 30;
const BASE_POINTS = 100;
const TIME_BONUS_PER_S = 3;
const COMBO_STEP = 0.2;
const COMBO_MAX = 4;
const DECAY_HOURS_BASE = 20;      // horas hasta olvido total
const INCOME_TICK_MS = 12000;
const MEMORY_DANGER = 30;

const RANKS = [
  [1,  'Ciudadano/a'],
  [3,  'Elector/a'],
  [5,  'Concejal/a'],
  [7,  'Alcalde/sa'],
  [9,  'Diputado/a'],
  [12, 'Senador/a'],
  [15, 'Ministro/a'],
  [18, 'Presidente/a del Gobierno'],
  [22, 'Padre/Madre de la Constitución'],
];

const ACHIEVEMENTS = [
  { id: 'first',    icon: '🚩', name: 'Primera conquista',       desc: 'Conquista tu primer territorio.', pts: 300 },
  { id: 'prepared', icon: '🎓', name: 'Buen estudiante',         desc: 'Completa la preparación de un territorio con el profesor.', pts: 200 },
  { id: 'combo5',   icon: '🔥', name: 'En racha',                desc: 'Encadena 5 aciertos seguidos.', pts: 300 },
  { id: 'combo10',  icon: '🌋', name: 'Imparable',               desc: 'Encadena 10 aciertos seguidos.', pts: 800 },
  { id: 'flawless', icon: '💎', name: 'Sin una sola grieta',     desc: 'Conquista el territorio más grande (Cortes, 31 arts) a la primera.', pts: 1000 },
  { id: 'flash',    icon: '⚡', name: 'Reflejos de jurista',     desc: 'Acierta una pregunta en menos de 4 segundos.', pts: 200 },
  { id: 'titulo1',  icon: '🕊️', name: 'Guardián de derechos',    desc: 'Domina los territorios de derechos y deberes (arts. 10–55).', pts: 800 },
  { id: 'poderes',  icon: '🏛️', name: 'División de poderes',     desc: 'Domina Corona, Cortes, Gobierno y Poder Judicial.', pts: 800 },
  { id: 'islas',    icon: '⛵', name: 'Salto entre islas',       desc: 'Conquista las dos islas: Tribunal Constitucional y Reforma.', pts: 700 },
  { id: 'defender', icon: '🛡️', name: 'Defensor del Pueblo',     desc: 'Defiende con éxito 5 territorios de El Olvido.', pts: 500 },
  { id: 'sabio',    icon: '🦉', name: 'Constitucionalista',      desc: 'Responde correctamente 200 preguntas.', pts: 1000 },
  { id: 'mapa',     icon: '👑', name: '¡Viva la Constitución!',  desc: 'Conquista los 15 territorios del continente.', pts: 3000 },
  { id: 'daily3',   icon: '📅', name: 'Costumbre parlamentaria', desc: 'Juega 3 días seguidos.', pts: 400 },
  { id: 'nivel10',  icon: '🎖️', name: 'Carrera de Estado',       desc: 'Alcanza el nivel 10.', pts: 1000 },
];

const $ = (id) => document.getElementById(id);
const terrById = (id) => TERRITORIES.find((t) => t.id === id);

/* ───────────────────────── Estado ───────────────────────── */

function defaultState() {
  const terr = {};
  for (const t of TERRITORIES) {
    terr[t.id] = { owned: !!t.start, stars: t.start ? 3 : 0, last: Date.now(), prepared: !!t.start };
  }
  return {
    score: 0, xp: 0, bestCombo: 0, prestige: 0,
    daily: { streak: 1, last: todayKey() },
    terr,
    ach: [],
    sound: true,
    seenIntro: false,
    stats: { answers: 0, correct: 0, conquests: 0, defenses: 0, attempts: 0, fastest: null, prepared: 0 },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultState();
    const s = { ...defaultState(), ...JSON.parse(raw) };
    for (const t of TERRITORIES) {
      if (!s.terr[t.id]) s.terr[t.id] = { owned: false, stars: 0, last: Date.now(), prepared: false };
    }
    return s;
  } catch { return defaultState(); }
}

let S = loadState();
let combo = 0;

function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* sin storage */ } }

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/* ───────────────────────── Utilidades ───────────────────────── */

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function fmt(n) { return Math.round(n).toLocaleString('es-ES'); }

/* ───────────────────────── Sonido (WebAudio) ───────────────────────── */

let audioCtx = null;
function tone(freq, dur = 0.12, type = 'sine', delay = 0, vol = 0.14) {
  if (!S.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch { /* sin audio */ }
}
const sfx = {
  correct() { tone(660, .1, 'sine'); tone(880, .14, 'sine', .08); },
  wrong()   { tone(180, .25, 'sawtooth', 0, .12); tone(140, .3, 'sawtooth', .1, .1); },
  click()   { tone(500, .05, 'triangle', 0, .07); },
  page()    { tone(700, .05, 'sine', 0, .05); },
  conquest(){ [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'triangle', i * .11, .17)); },
  defeat()  { [330, 262, 196].forEach((f, i) => tone(f, .22, 'sine', i * .14, .13)); },
  ach()     { tone(784, .1, 'sine'); tone(988, .1, 'sine', .09); tone(1319, .22, 'sine', .18); },
  tick()    { tone(900, .04, 'square', 0, .05); },
};

/* ───────────────────────── Memoria / El Olvido ───────────────────────── */

function decayHours() { return Math.max(6, DECAY_HOURS_BASE - S.prestige * 3); }
function memoryOf(id) {
  const t = S.terr[id];
  if (!t.owned) return 0;
  const hours = (Date.now() - t.last) / 3600000;
  return Math.max(0, Math.min(100, 100 - (hours / decayHours()) * 100));
}
function refreshMemory(id) { S.terr[id].last = Date.now(); }

/* ───────────────────────── Multiplicadores / niveles ───────────────────────── */

function globalMult() {
  const daily = 1 + 0.05 * Math.min(S.daily.streak - 1, 10);
  const prestige = 1 + 0.5 * S.prestige;
  return daily * prestige;
}
function comboMult() { return Math.min(COMBO_MAX, 1 + COMBO_STEP * Math.max(0, combo - 1)); }
function xpNeed(level) { return Math.round(400 * Math.pow(level, 1.8)); }
function levelFromXp(xp) { let l = 1; while (xp >= xpNeed(l)) l++; return l; }
function rankFor(level) { let name = RANKS[0][1]; for (const [lvl, n] of RANKS) if (level >= lvl) name = n; return name; }

/* ───────────────────────── Puntos ───────────────────────── */

function addXp(pts) {
  const prev = levelFromXp(S.xp);
  S.xp += Math.round(pts / 3);
  const now = levelFromXp(S.xp);
  if (now > prev) {
    toast(`🎖️ ¡Asciendes a nivel ${now} — ${rankFor(now)}!`);
    sfx.ach();
    if (now >= 10) unlock('nivel10');
  }
}

function bump(el) {
  const p = el.parentElement;
  p.classList.add('bump');
  setTimeout(() => p.classList.remove('bump'), 180);
}

function floater(text, x, y) {
  const f = document.createElement('div');
  f.className = 'floater';
  f.textContent = text;
  f.style.left = `${x}px`;
  f.style.top = `${y}px`;
  $('floaters').appendChild(f);
  setTimeout(() => f.remove(), 1400);
}

function toast(msg, cls = '') {
  const t = document.createElement('div');
  t.className = `toast ${cls}`;
  t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

/* ───────────────────────── Logros ───────────────────────── */

function unlock(id) {
  if (S.ach.includes(id)) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  S.ach.push(id);
  toast(`🏆 Logro: ${a.name} (+${a.pts} pts)`, 'ach-toast');
  sfx.ach();
  S.score += a.pts;
  S.xp += Math.round(a.pts / 3);
  renderHud();
  save();
}

function checkGroupAchievements() {
  const owned = (id) => S.terr[id].owned;
  if (['dignidad', 'derechos', 'deberes', 'rectores', 'garantias'].every(owned)) unlock('titulo1');
  if (['corona', 'cortes', 'gobierno', 'judicial'].every(owned)) unlock('poderes');
  if (['tc', 'reforma'].every(owned)) unlock('islas');
  if (TERRITORIES.every((t) => owned(t.id))) { unlock('mapa'); showVictory(); }
}

/* ───────────────────────── Racha diaria ───────────────────────── */

function checkDaily() {
  const today = todayKey();
  if (S.daily.last === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
  S.daily.streak = (S.daily.last === yesterday) ? S.daily.streak + 1 : 1;
  S.daily.last = today;
  if (S.daily.streak > 1) {
    const bonus = 200 * Math.min(S.daily.streak, 10);
    S.score += bonus;
    toast(`📅 ¡${S.daily.streak} días seguidos! Bonus +${fmt(bonus)} pts`);
  }
  if (S.daily.streak >= 3) unlock('daily3');
  save();
}

/* ───────────────────────── Mapa SVG ───────────────────────── */

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/* nº de tropas visibles = redondeo del nº de artículos escalado por estrellas/defensa */
function troopCountFor(id) {
  const arts = ARTICLES[id].length;
  return Math.max(2, Math.round(arts / 3));
}

function shadeColor(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * pct); g = Math.round(g + (255 - g) * pct); b = Math.round(b + (255 - b) * pct);
  return `rgb(${r},${g},${b})`;
}
function darken(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r * (1 - pct)); g = Math.round(g * (1 - pct)); b = Math.round(b * (1 - pct));
  return `rgb(${r},${g},${b})`;
}

function buildMap() {
  const svg = $('map');
  svg.setAttribute('viewBox', `0 0 ${MAP.view[0]} ${MAP.view[1]}`);
  svg.innerHTML = '';

  // definiciones: sombra del continente + texturas
  const defs = svgEl('defs');
  defs.innerHTML = `
    <filter id="landShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000" flood-opacity="0.45"/>
    </filter>
    <radialGradient id="sea" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="#1b3a52"/>
      <stop offset="60%" stop-color="#132b3f"/>
      <stop offset="100%" stop-color="#0d1f2e"/>
    </radialGradient>`;
  svg.appendChild(defs);

  // fondo mar
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: MAP.view[0], height: MAP.view[1], fill: 'url(#sea)' }));

  // olas decorativas
  const wavesG = svgEl('g', { opacity: '0.25' });
  for (let i = 0; i < 26; i++) {
    const wx = Math.random() * MAP.view[0], wy = Math.random() * MAP.view[1];
    const w = svgEl('path', { d: `M ${wx} ${wy} q 8 -5 16 0 t 16 0`, stroke: '#4a7090', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' });
    wavesG.appendChild(w);
  }
  svg.appendChild(wavesG);

  // rutas marítimas (bajo la tierra de las islas pero sobre el mar)
  const routesG = svgEl('g', { id: 'seaRoutesG' });
  for (const [a, b] of MAP.seaRoutes) {
    const [ax, ay] = MAP.centers[a], [bx, by] = MAP.centers[b];
    const mx = (ax + bx) / 2, my = (ay + by) / 2 - 30;
    routesG.appendChild(svgEl('path', {
      d: `M ${ax} ${ay} Q ${mx} ${my} ${bx} ${by}`,
      class: 'sea-route', 'data-a': a, 'data-b': b,
    }));
  }
  svg.appendChild(routesG);

  // sombra base de todo el continente (silueta unificada)
  const shadowG = svgEl('g', { filter: 'url(#landShadow)' });
  for (const t of TERRITORIES) {
    shadowG.appendChild(svgEl('path', { d: MAP.land[t.id], fill: '#0d1f2e' }));
  }
  svg.appendChild(shadowG);

  // territorios
  const terrG = svgEl('g', { id: 'terrG' });
  for (const t of TERRITORIES) {
    const c = MAP.centers[t.id];
    const g = svgEl('g', { class: 'terr', 'data-id': t.id });

    const land = svgEl('path', { d: MAP.land[t.id], class: 'land' });
    g.appendChild(land);

    // brillo costero interno
    g.appendChild(svgEl('path', { d: MAP.land[t.id], class: 'coast' }));

    // etiqueta: bandera/estandarte con icono + nombre corto
    const labelG = svgEl('g', { class: 't-label' });
    const nameLines = t.name.split(' ');
    // capa de tropas (se rellena en refreshMap)
    g.appendChild(svgEl('g', { class: 't-troops' }));

    const banner = svgEl('g', { class: 't-banner', transform: `translate(${c[0]},${c[1]})` });
    banner.appendChild(svgEl('text', { class: 't-icon', y: -26 }));
    banner.querySelector('.t-icon').textContent = t.icon;
    const nm = svgEl('text', { class: 't-name', y: -4 });
    nm.textContent = t.name;
    banner.appendChild(nm);
    const arts = svgEl('text', { class: 't-arts', y: 12 });
    arts.textContent = `${ARTICLES[t.id].length} arts.`;
    banner.appendChild(arts);
    const badge = svgEl('text', { class: 't-badge', y: 27 });
    banner.appendChild(badge);
    labelG.appendChild(banner);
    g.appendChild(labelG);

    g.addEventListener('click', () => onTerritoryClick(t.id));
    terrG.appendChild(g);
  }
  svg.appendChild(terrG);

  $('floaters').style.display = 'block';
  refreshMap();
}

function statusOf(id) {
  if (S.terr[id].owned) return 'owned';
  const t = terrById(id);
  const neighbors = MAP.adj[id] || [];
  return neighbors.some((a) => S.terr[a].owned) ? 'attackable' : 'locked';
}

/* dibuja las tropas: fila de fichas temáticas (emoji de la facción) bajo el nombre.
   El nº total de fichas es troopCountFor; se muestran hasta 5 y un "×N" si hay más. */
function renderTroops(g, t, status) {
  const layer = g.querySelector('.t-troops');
  layer.innerHTML = '';
  const c = MAP.centers[t.id];
  const owned = status === 'owned';
  const total = troopCountFor(t.id);
  const shown = Math.min(5, total);
  const faction = t.faction.unit;

  const r = 14;
  const gap = 30;
  const rowW = (shown - 1) * gap;
  const y0 = c[1] + 42;
  const x0 = c[0] - rowW / 2;

  for (let i = 0; i < shown; i++) {
    const tx = x0 + i * gap;
    const troop = svgEl('g', { class: 'troop', transform: `translate(${tx},${y0})` });
    troop.style.animationDelay = `${(i * 0.14).toFixed(2)}s`;
    const disc = svgEl('circle', { r, class: 'troop-disc' });
    // ficha clara (tipo pieza de juego) con borde del color del territorio → contrasta en todos los estados
    disc.style.fill = owned ? '#fbf6e9' : '#d7dbe6';
    disc.style.stroke = owned ? shadeColor(t.color, 0.15) : t.color;
    disc.style.strokeWidth = owned ? '3' : '3';
    troop.appendChild(disc);
    const em = svgEl('text', { class: 'troop-em', y: 5 });
    em.textContent = faction;
    troop.appendChild(em);
    layer.appendChild(troop);
  }

  if (total > shown) {
    const cnt = svgEl('text', { class: 'troop-count', x: x0 + shown * gap - gap / 2 + 12, y: y0 + 5 });
    cnt.textContent = `×${total}`;
    cnt.style.fill = owned ? '#fff' : '#c3ccdf';
    layer.appendChild(cnt);
  }
}

function refreshMap() {
  for (const t of TERRITORIES) {
    const g = document.querySelector(`.terr[data-id="${t.id}"]`);
    if (!g) continue;
    const st = statusOf(t.id);
    const mem = memoryOf(t.id);
    const danger = st === 'owned' && mem < MEMORY_DANGER;

    g.classList.toggle('owned', st === 'owned');
    g.classList.toggle('attackable', st === 'attackable');
    g.classList.toggle('locked', st === 'locked');
    g.classList.toggle('danger', danger);

    const land = g.querySelector('.land');
    if (st === 'owned') {
      land.style.fill = `url(#grad_${t.id})` in land ? '' : t.color;
      land.style.fill = t.color;
      land.style.filter = danger ? 'saturate(0.6) brightness(0.85)' : '';
    } else if (st === 'attackable') {
      land.style.fill = darken(t.color, 0.45);
      land.style.filter = '';
    } else {
      land.style.fill = '#2a3646';
      land.style.filter = 'grayscale(0.7)';
    }

    const badge = g.querySelector('.t-badge');
    if (st === 'owned') {
      badge.textContent = '★'.repeat(S.terr[t.id].stars) + '☆'.repeat(3 - S.terr[t.id].stars);
      badge.style.fill = '#ffd77a';
    } else if (st === 'attackable') {
      badge.textContent = t.island ? '⛵ atacable' : '⚔️ atacable';
      badge.style.fill = '#ffe1a1';
    } else {
      badge.textContent = '🔒';
      badge.style.fill = '#66708a';
    }

    renderTroops(g, t, st);
  }

  // rutas marítimas: iluminadas si conectan frontera de conquista
  document.querySelectorAll('.sea-route').forEach((r) => {
    const a = r.getAttribute('data-a'), b = r.getAttribute('data-b');
    const lit = S.terr[a].owned !== S.terr[b].owned;
    const both = S.terr[a].owned && S.terr[b].owned;
    r.classList.toggle('lit', lit);
    r.classList.toggle('owned', both);
  });

  const owned = TERRITORIES.filter((t) => S.terr[t.id].owned).length;
  $('progressLabel').textContent = `Territorios: ${owned}/${TERRITORIES.length}`;
  $('terrFill').style.width = `${(owned / TERRITORIES.length) * 100}%`;

  const inDanger = TERRITORIES.filter((t) => S.terr[t.id].owned && memoryOf(t.id) < MEMORY_DANGER);
  $('hintText').textContent = inDanger.length
    ? `🌫️ El Olvido asedia ${inDanger.length === 1 ? terrById(inDanger[0].id).name : inDanger.length + ' territorios'}. ¡Defiéndelos!`
    : 'Pulsa un territorio atacable (color vivo) para prepararte y conquistarlo ⚔️';
}

/* ───────────────────────── HUD ───────────────────────── */

function renderHud() {
  $('hudScore').textContent = fmt(S.score);
  $('hudCombo').textContent = `×${comboMult().toFixed(2).replace(/\.?0+$/, '')}`;
  $('comboChip').classList.toggle('hot', combo >= 2);
  $('hudStreak').textContent = S.daily.streak;

  const level = levelFromXp(S.xp);
  $('hudLevel').textContent = `Nv. ${level}`;
  $('hudRank').textContent = rankFor(level);
  const prev = level > 1 ? xpNeed(level - 1) : 0;
  const pct = ((S.xp - prev) / (xpNeed(level) - prev)) * 100;
  $('xpFill').style.width = `${Math.max(2, Math.min(100, pct))}%`;

  $('btnSound').textContent = S.sound ? '🔊' : '🔇';

  const pb = $('prestigeBadge');
  pb.hidden = S.prestige === 0;
  if (S.prestige > 0) pb.textContent = `⭐ Legislatura ${['II', 'III', 'IV', 'V', 'VI'][Math.min(S.prestige - 1, 4)]} · ×${(1 + 0.5 * S.prestige).toFixed(1)}`;
}

/* ───────────────────────── Escena visual del artículo ───────────────────────── */

function sceneHTML(art) {
  return `<div class="scene">${art.img.map((e) => `<span class="scene-emoji">${e}</span>`).join('<span class="scene-plus">+</span>')}</div>`;
}

/* ───────────────────────── Modo preparación (profesor) ───────────────────────── */

let PREP = null;

function startPrep(tid) {
  closeAll();
  const t = terrById(tid);
  PREP = { tid, i: 0, arts: ARTICLES[tid] };
  $('prepFaction').textContent = t.faction.name;
  $('prepProfEmoji').textContent = t.prof.emoji;
  $('prepProfName').textContent = t.prof.name;
  $('prepColor').style.setProperty('--terr-color', t.color);
  $('prep').hidden = false;
  renderPrepCard();
}

function renderPrepCard() {
  const t = terrById(PREP.tid);
  const art = PREP.arts[PREP.i];
  const total = PREP.arts.length;
  $('prepProgress').textContent = `Artículo ${PREP.i + 1} de ${total}`;
  $('prepDots').innerHTML = PREP.arts.map((_, i) =>
    `<span class="pdot ${i === PREP.i ? 'on' : ''} ${i < PREP.i ? 'seen' : ''}"></span>`).join('');
  $('prepArtNum').textContent = `Art. ${art.n}`;
  $('prepArtTitle').textContent = art.t;
  $('prepScene').innerHTML = sceneHTML(art);
  $('prepExp').textContent = art.e;
  $('prepMnemo').innerHTML = `<span class="mnemo-tag">💡 Truco para recordarlo</span>${art.mn}`;
  $('prepPrev').disabled = PREP.i === 0;
  const last = PREP.i === total - 1;
  $('prepNext').textContent = last ? '¡Listo para conquistar! ⚔️' : 'Siguiente ➜';
  $('prepNext').classList.toggle('ready', last);
}

function prepStep(dir) {
  sfx.page();
  const total = PREP.arts.length;
  if (dir > 0 && PREP.i === total - 1) {
    // terminó la preparación
    if (!S.terr[PREP.tid].prepared) { S.stats.prepared++; }
    S.terr[PREP.tid].prepared = true;
    unlock('prepared');
    save();
    const tid = PREP.tid;
    PREP = null;
    $('prep').hidden = true;
    openPreBattle(tid, true);
    return;
  }
  PREP.i = Math.max(0, Math.min(total - 1, PREP.i + dir));
  renderPrepCard();
}

/* ───────────────────────── Batalla de conquista (una pregunta por artículo) ───────────────────────── */

let B = null;
let timerId = null;

function startBattle(tid, mode) {
  closeAll();
  S.stats.attempts++;
  const t = terrById(tid);
  let arts;
  if (mode === 'attack') {
    arts = ARTICLES[tid];                                   // todos, en orden
  } else {
    // defensa / repaso: subconjunto aleatorio
    const k = Math.min(mode === 'defense' ? 4 : 3, ARTICLES[tid].length);
    arts = shuffle(ARTICLES[tid]).slice(0, k);
  }
  B = { tid, mode, arts, i: 0, correctCount: 0, earned: 0, answered: false, qStart: 0, need: arts.length };

  $('bIcon').textContent = t.icon;
  $('bName').textContent = t.name;
  $('bMode').textContent = mode === 'attack' ? '⚔️ Conquista' : mode === 'defense' ? '🛡️ Defensa contra El Olvido' : '📖 Repaso';
  $('bRule').textContent = mode === 'attack'
    ? `Una pregunta por artículo (${arts.length}). Falla una y la conquista se detiene: no puedes equivocarte en ninguna.`
    : `${arts.length} preguntas. Falla una y pierdes la batalla.`;
  $('battle').hidden = false;
  askQuestion();
}

function askQuestion() {
  const art = B.arts[B.i];
  B.art = art;
  B.answered = false;

  const order = shuffle(art.o.map((_, i) => i));
  B.correctBtn = order.indexOf(art.c);

  $('bArtLabel').textContent = `Art. ${art.n} · ${art.t}`;
  $('bScene').innerHTML = sceneHTML(art);
  $('qText').textContent = art.q;
  const box = $('qOptions');
  box.innerHTML = '';
  order.forEach((optIdx, i) => {
    const btn = document.createElement('button');
    btn.className = 'q-opt';
    btn.innerHTML = `<span class="k">${i + 1}</span><span>${art.o[optIdx]}</span>`;
    btn.addEventListener('click', () => answer(i));
    box.appendChild(btn);
  });

  $('qFeedback').hidden = true;
  renderBattleStatus();
  startTimer();
  B.qStart = Date.now();
}

/* barra de progreso de la conquista: un escudo por artículo */
function renderBattleStatus() {
  $('bProgress').innerHTML = B.arts.map((_, i) => {
    const cls = i < B.i ? 'done' : i === B.i ? 'cur' : '';
    return `<span class="pip ${cls}"></span>`;
  }).join('');
  $('bCounter').textContent = `${B.correctCount}/${B.need}`;
}

function startTimer() {
  stopTimer();
  const fill = $('timerFill');
  fill.className = '';
  const t0 = Date.now();
  timerId = setInterval(() => {
    const left = QUESTION_SECONDS - (Date.now() - t0) / 1000;
    const pct = Math.max(0, (left / QUESTION_SECONDS) * 100);
    fill.style.width = `${pct}%`;
    fill.className = pct < 20 ? 'crit' : pct < 45 ? 'warn' : '';
    if (left <= 5.2 && left > 5.0) sfx.tick();
    if (left <= 0) { stopTimer(); answer(-1); }
  }, 100);
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

function answer(btnIdx) {
  if (!B || B.answered) return;
  B.answered = true;
  stopTimer();

  const secondsUsed = (Date.now() - B.qStart) / 1000;
  const remaining = Math.max(0, QUESTION_SECONDS - secondsUsed);
  const correct = btnIdx === B.correctBtn;
  const opts = $('qOptions').children;
  for (const o of opts) o.disabled = true;

  S.stats.answers++;

  const banner = $('fbBanner');
  if (correct) {
    S.stats.correct++;
    combo++;
    S.bestCombo = Math.max(S.bestCombo, combo);
    if (combo >= 5) unlock('combo5');
    if (combo >= 10) unlock('combo10');
    if (secondsUsed < 4) unlock('flash');
    if (S.stats.correct >= 200) unlock('sabio');
    if (S.stats.fastest === null || secondsUsed < S.stats.fastest) S.stats.fastest = secondsUsed;

    B.correctCount++;
    const modeFactor = B.mode === 'attack' ? 1 : B.mode === 'defense' ? 1.4 : 0.6;
    const pts = Math.round((BASE_POINTS + remaining * TIME_BONUS_PER_S) * comboMult() * globalMult() * modeFactor);
    B.earned += pts;
    S.score += pts;
    addXp(pts);

    opts[btnIdx].classList.add('correct');
    banner.className = 'fb-banner ok';
    banner.innerHTML = `<span>✅ ¡Correcto!${combo >= 2 ? ` 🔥 ×${comboMult().toFixed(2).replace(/\.?0+$/, '')}` : ''}</span><span class="pts">+${fmt(pts)} pts</span>`;
    sfx.correct();
    bump($('hudScore'));
  } else {
    combo = 0;
    if (btnIdx >= 0) opts[btnIdx].classList.add('wrong');
    opts[B.correctBtn].classList.add('correct');
    for (const o of opts) if (!o.classList.contains('correct') && !o.classList.contains('wrong')) o.classList.add('faded');
    banner.className = 'fb-banner ko';
    banner.innerHTML = `<span>${btnIdx < 0 ? '⏰ ¡Tiempo agotado!' : '❌ Incorrecto'}</span>`;
    sfx.wrong();
  }

  $('fbRef').textContent = `📜 Art. ${B.art.n} CE · ${B.art.t}`;
  $('fbExp').textContent = B.art.e;
  $('fbMnemo').innerHTML = `💡 ${B.art.mn}`;
  $('qFeedback').hidden = false;
  renderBattleStatus();
  renderHud();
  save();

  const willWin = correct && B.i === B.arts.length - 1;
  $('btnNext').textContent = !correct ? 'Ver resultado…' : willWin ? '¡Plantar la bandera! 🚩' : 'Siguiente artículo ➜';
  $('btnNext').focus();
}

function nextStep() {
  if (!B) return;
  // si la última respuesta fue incorrecta → fin (derrota); una sola falla detiene la conquista
  if ($('fbBanner').classList.contains('ko')) return endBattle(false);
  if (B.i >= B.arts.length - 1) return endBattle(true);
  B.i++;
  askQuestion();
}

function endBattle(won) {
  stopTimer();
  $('battle').hidden = true;
  const t = terrById(B.tid);
  const rows = [];
  let title, sub, emoji;

  if (won) {
    if (B.mode === 'attack') {
      // estrellas según intentos previos y velocidad (aquí: perfecto siempre = requiere no fallar)
      const firstTry = S.stats.attempts && S.terr[B.tid].stars === 0;
      const stars = 3; // conquistar exige no fallar → siempre impecable
      S.terr[B.tid] = { owned: true, stars, last: Date.now(), prepared: true };
      S.stats.conquests++;
      const bonus = Math.round(300 * B.arts.length * globalMult());
      S.score += bonus; addXp(bonus);
      B.earned += bonus;
      unlock('first');
      if (B.tid === 'cortes') unlock('flawless');
      emoji = '🎉'; title = `¡${t.name} conquistado!`;
      sub = `Has respondido sin fallar a los ${B.arts.length} artículos. ${t.faction.name} iza tu bandera.`;
      rows.push(['Botín de conquista', bonus]);
      sfx.conquest();
      confetti();
    } else if (B.mode === 'defense') {
      refreshMemory(B.tid);
      S.stats.defenses++;
      const bonus = Math.round(250 * globalMult());
      S.score += bonus; addXp(bonus);
      B.earned += bonus;
      if (S.stats.defenses >= 5) unlock('defender');
      emoji = '🛡️'; title = `¡${t.name} defendido!`;
      sub = 'El Olvido se retira. La memoria del territorio se restaura al 100 %.';
      rows.push(['Bonus de defensa', bonus]);
      sfx.conquest();
    } else {
      refreshMemory(B.tid);
      emoji = '📖'; title = `${t.name}: repaso superado`;
      sub = 'La memoria del territorio vuelve al 100 %.';
      sfx.correct();
    }
  } else {
    if (B.mode === 'defense') {
      S.terr[B.tid] = { owned: false, stars: 0, last: Date.now(), prepared: S.terr[B.tid].prepared };
      emoji = '🌫️'; title = `Has perdido ${t.name}`;
      sub = 'El Olvido ha tomado el territorio. Prepárate de nuevo y reconquístalo.';
    } else if (B.mode === 'attack') {
      emoji = '🛑'; title = 'Conquista detenida';
      sub = `Fallaste en el art. ${B.art.n}. Para tomar ${t.name} no puedes equivocarte en ninguno. Repasa con el profesor y vuelve.`;
    } else {
      emoji = '📕'; title = 'Repaso fallido';
      sub = 'Repasa los artículos y vuelve a intentarlo.';
    }
    sfx.defeat();
  }

  const base = B.earned - (rows[0] ? rows[0][1] : 0);
  rows.unshift(['Puntos por respuestas', base]);
  rows.push(['Total de la batalla', B.earned]);

  $('endEmoji').textContent = emoji;
  $('endTitle').textContent = title;
  $('endSub').textContent = sub;
  $('endBreakdown').innerHTML = rows.map(([l, v], i) =>
    `<div class="row ${i === rows.length - 1 ? 'total' : ''}"><span>${l}</span><b>+${fmt(v)} pts</b></div>`).join('');

  // botón de reintento rápido si perdió una conquista
  const retry = $('btnEndRetry');
  if (!won && B.mode === 'attack') {
    retry.hidden = false;
    retry.dataset.tid = B.tid;
  } else {
    retry.hidden = true;
  }

  $('battleEnd').hidden = false;
  B = null;
  renderHud();
  refreshMap();
  checkGroupAchievements();
  save();
}

/* ───────────────────────── Ficha previa (pre-batalla) ───────────────────────── */

function openPreBattle(tid, fromPrep) {
  closeAll();
  const t = terrById(tid);
  const st = statusOf(tid);
  $('pbIcon').textContent = t.icon;
  $('pbName').textContent = t.name;
  $('pbArts').textContent = `${t.artsLabel} · ${ARTICLES[tid].length} artículos`;
  $('pbFaction').innerHTML = `<span class="faction-badge" style="--terr-color:${t.color}">${t.faction.unit} ${t.faction.name}</span>`;

  const meta = $('pbMeta');
  const actions = $('pbActions');
  actions.innerHTML = '';
  const prepared = S.terr[tid].prepared;

  if (st === 'attackable') {
    $('pbDesc').textContent = t.island
      ? `Isla enemiga al otro lado del mar. Para desembarcar debes responder sin fallar a sus ${ARTICLES[tid].length} artículos.`
      : `Territorio bajo el dominio del Olvido. Para conquistarlo debes responder correctamente a sus ${ARTICLES[tid].length} artículos, sin fallar ni uno.`;
    meta.innerHTML = `
      <span class="meta-chip">📜 ${ARTICLES[tid].length} preguntas</span>
      <span class="meta-chip">⏱️ ${QUESTION_SECONDS}s cada una</span>
      <span class="meta-chip">${prepared ? '🎓 Preparado' : '📖 Sin preparar'}</span>`;

    const prep = document.createElement('button');
    prep.className = prepared ? 'secondary-btn' : 'primary-btn';
    prep.innerHTML = `🎓 ${prepared ? 'Repasar con' : 'Prepararme con'} ${t.prof.name}`;
    prep.addEventListener('click', () => startPrep(tid));
    actions.appendChild(prep);

    const atk = document.createElement('button');
    atk.className = prepared ? 'primary-btn' : 'secondary-btn';
    atk.innerHTML = t.island ? '⛵ ¡Desembarcar y conquistar!' : '⚔️ ¡Al ataque!';
    atk.addEventListener('click', () => startBattle(tid, 'attack'));
    actions.appendChild(atk);

    if (!prepared) {
      const tip = document.createElement('p');
      tip.className = 'pb-tip';
      tip.textContent = `💡 Consejo: ${t.prof.motto}`;
      actions.appendChild(tip);
    }
  } else {
    // territorio propio
    const mem = memoryOf(tid);
    const danger = mem < MEMORY_DANGER;
    $('pbDesc').textContent = danger
      ? '🌫️ ¡El Olvido asedia este territorio! Si pierdes la defensa, volverá a manos enemigas.'
      : 'Territorio bajo tu dominio. Repásalo para mantener viva su memoria.';
    meta.innerHTML = `
      <span class="meta-chip">${'★'.repeat(S.terr[tid].stars)}${'☆'.repeat(3 - S.terr[tid].stars)}</span>
      <span class="meta-chip">🧠 Memoria: ${Math.round(mem)} %</span>`;

    const prep = document.createElement('button');
    prep.className = 'secondary-btn';
    prep.innerHTML = `🎓 Estudiar con ${t.prof.name}`;
    prep.addEventListener('click', () => startPrep(tid));
    actions.appendChild(prep);

    const b = document.createElement('button');
    b.className = 'primary-btn';
    if (danger) {
      b.innerHTML = '🛡️ ¡Defender el territorio!';
      b.addEventListener('click', () => startBattle(tid, 'defense'));
    } else {
      b.innerHTML = '📖 Repaso rápido (restaura memoria)';
      b.addEventListener('click', () => startBattle(tid, 'review'));
    }
    actions.appendChild(b);
  }

  $('preBattle').hidden = false;
}

/* ───────────────────────── Interacción con el mapa ───────────────────────── */

function onTerritoryClick(tid) {
  sfx.click();
  const st = statusOf(tid);
  if (st === 'locked') {
    const g = document.querySelector(`.terr[data-id="${tid}"]`);
    g.classList.remove('shake'); void g.getBoundingClientRect();
    g.classList.add('shake');
    const t = terrById(tid);
    toast(t.island
      ? '🌊 Isla lejana: conquista antes un territorio con ruta marítima hasta ella.'
      : '🔒 Conquista antes un territorio vecino para llegar hasta aquí.', 'danger');
    return;
  }
  openPreBattle(tid, false);
}

/* ───────────────────────── Renta pasiva ───────────────────────── */

function incomeTick() {
  if (document.hidden || !$('battle').hidden || !$('prep').hidden) return;
  let gain = 0;
  for (const t of TERRITORIES) {
    if (S.terr[t.id].owned && memoryOf(t.id) >= MEMORY_DANGER) gain += S.terr[t.id].stars;
  }
  if (gain > 0) {
    gain = Math.round(gain * globalMult());
    S.score += gain;
    renderHud();
    const wrap = $('mapWrap').getBoundingClientRect();
    floater(`+${gain} 🏳️`, wrap.width - 130, 30);
    save();
  }
}

/* ───────────────────────── Confeti ───────────────────────── */

function confetti() {
  const canvas = $('confetti');
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth; canvas.height = innerHeight;
  const colors = ['#c60b1e', '#ffc400', '#e3a93f', '#fff', '#3fbf6f', '#b48cff'];
  const parts = Array.from({ length: 170 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.4,
    vx: (Math.random() - 0.5) * 3,
    vy: 2.5 + Math.random() * 4,
    size: 5 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.25,
  }));
  const t0 = Date.now();
  (function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (Date.now() - t0 < 2600) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })();
}

/* ───────────────────────── Victoria / prestigio ───────────────────────── */

function showVictory() {
  $('victoryStats').innerHTML = `
    <div class="row"><span>Puntuación</span><b>${fmt(S.score)} pts</b></div>
    <div class="row"><span>Mejor combo</span><b>×${S.bestCombo}</b></div>
    <div class="row"><span>Preguntas acertadas</span><b>${S.stats.correct}/${S.stats.answers}</b></div>
    <div class="row total"><span>Rango</span><b>${rankFor(levelFromXp(S.xp))}</b></div>`;
  $('btnPrestige').textContent = `🏛️ Nueva legislatura (puntos ×${(1 + 0.5 * (S.prestige + 1)).toFixed(1)})`;
  $('victoryModal').hidden = false;
  confetti();
  sfx.conquest();
}

function prestige() {
  S.prestige++;
  for (const t of TERRITORIES) {
    S.terr[t.id] = { owned: !!t.start, stars: t.start ? 3 : 0, last: Date.now(), prepared: !!t.start };
  }
  save();
  closeAll();
  refreshMap();
  renderHud();
  toast(`⭐ Nueva legislatura: todos los puntos ×${(1 + 0.5 * S.prestige).toFixed(1)}. ¡Reconquista el continente!`);
}

/* ───────────────────────── Modales ───────────────────────── */

function closeAll() {
  for (const id of ['preBattle', 'battleEnd', 'achModal', 'statsModal', 'introModal', 'victoryModal', 'prep']) {
    $(id).hidden = true;
  }
}

function showAchievements() {
  $('achList').innerHTML = ACHIEVEMENTS.map((a) => {
    const got = S.ach.includes(a.id);
    return `<div class="ach ${got ? '' : 'locked'}">
      <span class="a-icon">${got ? a.icon : '🔒'}</span>
      <div><div class="a-name">${a.name}</div><div class="a-desc">${a.desc}</div></div>
      <span class="a-pts">${got ? '✓ ' : ''}+${a.pts}</span>
    </div>`;
  }).join('');
  $('achModal').hidden = false;
}

function showStats() {
  const acc = S.stats.answers ? Math.round((S.stats.correct / S.stats.answers) * 100) : 0;
  const boxes = [
    [fmt(S.score), 'Puntos totales'],
    [`Nv. ${levelFromXp(S.xp)} — ${rankFor(levelFromXp(S.xp))}`, 'Rango'],
    [`${S.stats.correct}/${S.stats.answers} (${acc} %)`, 'Aciertos'],
    [`×${S.bestCombo}`, 'Mejor combo'],
    [S.stats.conquests, 'Conquistas'],
    [S.stats.prepared, 'Territorios preparados'],
    [S.stats.defenses, 'Defensas ganadas'],
    [S.stats.fastest ? `${S.stats.fastest.toFixed(1)} s` : '—', 'Respuesta más rápida'],
    [`${S.daily.streak} día(s)`, 'Racha diaria'],
    [`${S.ach.length}/${ACHIEVEMENTS.length}`, 'Logros'],
  ];
  $('statsList').innerHTML = boxes.map(([v, l]) =>
    `<div class="stat-box"><div class="s-val">${v}</div><div class="s-lbl">${l}</div></div>`).join('');
  $('statsModal').hidden = false;
}

/* ───────────────────────── Init ───────────────────────── */

function init() {
  buildMap();
  renderHud();
  checkDaily();

  $('btnAch').addEventListener('click', () => { closeAll(); showAchievements(); });
  $('btnStats').addEventListener('click', () => { closeAll(); showStats(); });
  $('btnHelp').addEventListener('click', () => { closeAll(); $('introModal').hidden = false; });
  $('btnSound').addEventListener('click', () => { S.sound = !S.sound; renderHud(); save(); });

  $('btnIntroOk').addEventListener('click', () => { S.seenIntro = true; save(); $('introModal').hidden = true; sfx.click(); });

  $('prepPrev').addEventListener('click', () => prepStep(-1));
  $('prepNext').addEventListener('click', () => prepStep(1));
  $('prepSkip').addEventListener('click', () => { const tid = PREP.tid; PREP = null; $('prep').hidden = true; openPreBattle(tid, false); });

  $('btnNext').addEventListener('click', nextStep);
  $('bFlee').addEventListener('click', () => { if (B) endBattle(false); });
  $('btnEndOk').addEventListener('click', () => { $('battleEnd').hidden = true; });
  $('btnEndRetry').addEventListener('click', () => { const tid = $('btnEndRetry').dataset.tid; $('battleEnd').hidden = true; openPreBattle(tid, false); });

  $('btnPrestige').addEventListener('click', prestige);
  $('btnVictoryStay').addEventListener('click', () => { $('victoryModal').hidden = true; });

  $('btnReset').addEventListener('click', () => {
    if (confirm('¿Seguro? Se borrará toda la partida: puntos, territorios y logros.')) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    }
  });

  document.querySelectorAll('.card-close').forEach((b) =>
    b.addEventListener('click', () => { $(b.dataset.close).hidden = true; }));

  document.addEventListener('keydown', (e) => {
    if (!$('battle').hidden && B && !B.answered && e.key >= '1' && e.key <= '4') {
      const i = Number(e.key) - 1;
      if ($('qOptions').children[i]) answer(i);
    } else if (!$('battle').hidden && B && B.answered && e.key === 'Enter') {
      nextStep();
    } else if (!$('prep').hidden && PREP) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') prepStep(1);
      else if (e.key === 'ArrowLeft') prepStep(-1);
    }
  });

  setInterval(incomeTick, INCOME_TICK_MS);
  setInterval(refreshMap, 30000);

  const params = new URLSearchParams(location.search);
  if (!S.seenIntro && !params.has('nointro')) $('introModal').hidden = false;

  const besieged = TERRITORIES.filter((t) => S.terr[t.id].owned && !t.start && memoryOf(t.id) < MEMORY_DANGER);
  if (besieged.length) setTimeout(() => toast(`🌫️ El Olvido asedia ${besieged.length} territorio(s). ¡Defiéndelos!`, 'danger'), 800);
}

document.addEventListener('DOMContentLoaded', init);
