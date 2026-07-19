/* =========================================================================
   Estadísticas unificadas (accesibles desde el menú principal).
   Se agregan SIEMPRE por cuenta de usuario: se combinan los datos de TODAS
   las partidas guardadas en la cuenta en la nube (no solo la que está
   activa ahora mismo), tomando en cada métrica lo mejor conseguido en
   cualquiera de ellas.
   Tres KPI para el opositor:
     1) DOMINIO — lo bien que te sabes la Constitución. Media de tu maestría en los 5 juegos; cada juego solo llega a 1.0 a su máxima dificultad, así
        que el 100% exige ser maestro en los 4 al máximo. Filtrable por juego.
     2) FRESCURA — lo reciente de esa valoración (decae con los días sin jugar).
     3) ESFUERZO — tu tiempo de estudio en el tiempo (curva).
   ========================================================================= */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const sfxSafe = (k) => { try { if (typeof sfx !== 'undefined' && sfx[k]) sfx[k](); } catch { /* */ } };
  const pget = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
  const WD = { facil: 0.6, normal: 0.8, medio: 0.8, dificil: 1.0 };

  /* ── datos agregados de TODAS las partidas de la cuenta ── */
  function mergeMax(dst, src) { for (const k of Object.keys(src || {})) dst[k] = Math.max(dst[k] || 0, src[k] || 0); }
  function mergeMin(dst, src) { for (const k of Object.keys(src || {})) { const v = src[k]; if (v == null) continue; dst[k] = dst[k] == null ? v : Math.min(dst[k], v); } }
  function mergeSum(dst, src) { for (const k of Object.keys(src || {})) dst[k] = (dst[k] || 0) + (src[k] || 0); }

  function crudosDe(clave) {
    const out = [];
    out.push(clave === 'ce78_warchallenge_v3' && typeof S !== 'undefined' ? S : pget(clave));
    try {
      const partidas = (typeof CUENTA !== 'undefined' && CUENTA.todasLasPartidas) ? CUENTA.todasLasPartidas() : [];
      for (const p of partidas) {
        const raw = p && p.data && p.data[clave];
        if (!raw) continue;
        try { out.push(JSON.parse(raw)); } catch { /* */ }
      }
    } catch { /* */ }
    return out;
  }

  function agregar() {
    const conq = { mastered: {}, hiConq: {}, best: {}, days: {}, lastActive: 0 };
    for (const o of crudosDe('ce78_warchallenge_v3')) {
      const st = (o && o.stats) || {};
      Object.assign(conq.mastered, st.mastered || {});
      mergeMax(conq.hiConq, st.hiConq); mergeMin(conq.best, st.best); mergeSum(conq.days, st.days);
      conq.lastActive = Math.max(conq.lastActive, st.lastActive || 0);
    }
    const mem = { hi: {} };
    for (const o of crudosDe('ce78_memoria_v2')) mergeMax(mem.hi, (o || {}).hi);
    const trib = { total: 10, bestD: {} };
    for (const o of crudosDe('ce78_tribunal_v1')) {
      if (o && o.total) trib.total = o.total;
      const bd = (o && o.bestD) || (o && o.best ? { medio: o.best } : {});
      for (const d of Object.keys(bd || {})) {
        const b = bd[d] || {}; const t = trib.bestD[d] || (trib.bestD[d] = { abogado: 0, juez: 0 });
        t.abogado = Math.max(t.abogado, b.abogado || 0); t.juez = Math.max(t.juez, b.juez || 0);
      }
    }
    const triv = { perDiff: {} };
    for (const o of crudosDe('ce78_trivial_v1')) {
      const pd = (o && o.perDiff) || (o && o.bestWedges != null ? { medio: { bestWedges: o.bestWedges, wins: o.wins || 0 } } : {});
      for (const d of Object.keys(pd || {})) {
        const r = pd[d] || {}; const t = triv.perDiff[d] || (triv.perDiff[d] = { bestWedges: 0, wins: 0 });
        t.bestWedges = Math.max(t.bestWedges, r.bestWedges || 0); t.wins += r.wins || 0;
      }
    }
    const isl = { runs: {} };
    for (const o of crudosDe('ce78_islas_v1')) {
      const runs = (o && o.runs) || (o && o.owned ? { medio: { owned: o.owned } } : {});
      for (const d of Object.keys(runs || {})) {
        const own = isl.runs[d] || (isl.runs[d] = { owned: {} });
        Object.assign(own.owned, (runs[d] || {}).owned || {});
      }
    }
    return { conq, mem, trib, triv, isl };
  }

  let AGG = { conq: { mastered: {}, hiConq: {}, best: {}, days: {}, lastActive: 0 }, mem: { hi: {} }, trib: { total: 10, bestD: {} }, triv: { perDiff: {} }, isl: { runs: {} } };

  /* ── maestría por juego (0..1); 1.0 solo a máxima dificultad ── */
  function mConquista() { const hi = AGG.conq.hiConq || {}; let m = 0; ['facil', 'normal', 'dificil'].forEach((d) => { m = Math.max(m, ((hi[d] || 0) / 169) * WD[d]); }); return m; }
  function mMemoria() { const hi = AGG.mem.hi || {}; let m = 0; ['facil', 'medio', 'dificil'].forEach((d) => { m = Math.max(m, ((hi[d] || 0) / 169) * WD[d]); }); return m; }
  function mTribunal() {
    const N = AGG.trib.total || 10; let m = 0;
    const prog = (b) => ((Math.min(b.abogado || 0, N) / N) + (Math.min(b.juez || 0, N) / N)) / 2;
    for (const d of Object.keys(AGG.trib.bestD || {})) m = Math.max(m, prog(AGG.trib.bestD[d]) * (WD[d] || 0.8));
    return m;
  }
  function mTrivial() {
    let m = 0;
    for (const d of Object.keys(AGG.triv.perDiff || {})) {
      const r = AGG.triv.perDiff[d];
      const prog = (r.wins || 0) > 0 ? 1 : Math.min(1, (r.bestWedges || 0) / 11) * 0.9; // solo GANAR da el 100% del nivel
      m = Math.max(m, prog * (WD[d] || 0.8));
    }
    return m;
  }
  function mIslas() {
    let m = 0;
    for (const d of Object.keys(AGG.isl.runs || {})) m = Math.max(m, (Object.keys((AGG.isl.runs[d] || {}).owned || {}).length / 169) * (WD[d] || 0.8));
    return m;
  }

  const GAMES = [
    { key: 'conquista', name: 'Conquista', emoji: '⚔️', color: '#e0a52e', m: mConquista },
    { key: 'memoria', name: 'Memorión', emoji: '🃏', color: '#4d92e0', m: mMemoria },
    { key: 'tribunal', name: 'Tribunal', emoji: '🏛️', color: '#d24b3e', m: mTribunal },
    { key: 'trivial', name: 'Trivial', emoji: '❓', color: '#2f9e5f', m: mTrivial },
    { key: 'islas', name: 'Islas', emoji: '🏝️', color: '#2fa3c9', m: mIslas },
  ];
  const dominioGlobal = () => GAMES.reduce((s, g) => s + g.m(), 0) / GAMES.length;
  function freshness() {
    const la = AGG.conq.lastActive || 0;
    if (!la) return { pct: 0, days: null };
    const days = (Date.now() - la) / 86400000;
    return { pct: 100 * Math.pow(0.5, days / 15), days };
  }
  function freshLabel(days) {
    if (days == null) return 'Aún no has jugado';
    if (days < 1) return 'Recién medido (hoy)';
    if (days < 2) return 'Medido ayer';
    if (days < 7) return `Hace ${Math.round(days)} días`;
    if (days < 30) return `Hace ${Math.round(days / 7)} semana(s)`;
    if (days < 365) return `Hace ${Math.round(days / 30)} mes(es)`;
    return `Hace más de un año`;
  }

  /* ── gráfico de esfuerzo (curva suave de minutos/día) ── */
  function lastDays(n) {
    const days = AGG.conq.days || {}; const out = []; const base = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(base); d.setDate(base.getDate() - i);
      const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      out.push({ dom: d.getDate(), month: d.getMonth() + 1, dow: d.getDay(), min: (days[k] || 0) / 60000 });
    }
    return out;
  }

  /* ── media de juego diario de la última semana (7 días, ceros incluidos) ── */
  const DOW = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  function weekCard() {
    const days = lastDays(7);
    const total = days.reduce((s, d) => s + d.min, 0);
    const media = total / 7;
    const max = Math.max(10, ...days.map((d) => d.min));
    const bars = days.map((d) => `
      <div class="wk-day" title="${d.dom}/${d.month}: ${Math.round(d.min)} min">
        <div class="wk-bar"><div class="wk-fill ${d.min > 0 ? '' : 'cero'}" style="height:${Math.max(4, (d.min / max) * 100)}%"></div></div>
        <span class="wk-lbl">${DOW[d.dow]}</span>
      </div>`).join('');
    return `<div class="kpi-card kpi-week">
      <div class="kpi-card-head"><span>📅 Media de juego diario · última semana</span><b class="wk-media">${media >= 10 ? Math.round(media) : media.toFixed(1)} min/día</b></div>
      <div class="wk-bars">${bars}</div>
      <div class="kpi-card-foot">Total de la semana: ${Math.round(total)} min · ${days.filter((d) => d.min > 0).length} de 7 días jugados.</div>
    </div>`;
  }
  function smoothPath(pts) {
    if (pts.length < 2) return pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : '';
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  }
  function effortChart() {
    const N = 30, days = lastDays(N);
    const W = 320, H = 130, padL = 4, padR = 4, padT = 10, padB = 20;
    const maxMin = Math.max(10, ...days.map((d) => d.min));
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const pts = days.map((d, i) => [padL + (i / (N - 1)) * plotW, padT + plotH - (d.min / maxMin) * plotH]);
    const line = smoothPath(pts);
    const area = line + ` L ${pts[pts.length - 1][0].toFixed(1)} ${(padT + plotH).toFixed(1)} L ${pts[0][0].toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
    let xlab = '';
    for (let i = 0; i < N; i += 7) xlab += `<text x="${pts[i][0].toFixed(1)}" y="${H - 5}" class="ef-x">${days[i].dom}/${days[i].month}</text>`;
    const totalMin = Math.round(days.reduce((s, d) => s + d.min, 0));
    const activeDays = days.filter((d) => d.min > 0).length;
    return { svg: `<svg viewBox="0 0 ${W} ${H}" class="effort-chart" preserveAspectRatio="none">
      <defs><linearGradient id="efg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--gold)" stop-opacity="0.45"/><stop offset="1" stop-color="var(--gold)" stop-opacity="0"/></linearGradient></defs>
      <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" class="ef-base"/>
      <path d="${area}" class="ef-area"/><path d="${line}" class="ef-line"/>${xlab}</svg>`,
      totalMin, activeDays };
  }

  function ring(pct, color) {
    const r = 50, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return `<svg viewBox="0 0 130 130" class="kpi-ring">
      <circle cx="65" cy="65" r="${r}" class="ring-bg"/>
      <circle cx="65" cy="65" r="${r}" class="ring-fg" style="stroke:${color};stroke-dasharray:${c.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"/>
      <text x="65" y="66" class="ring-val">${Math.round(pct)}%</text></svg>`;
  }
  function bar(pct, color) { return `<div class="kpi-bar"><div class="kpi-bar-fill" style="width:${Math.max(2, pct)}%;background:${color}"></div></div>`; }

  let filter = 'all';
  function renderFilter() {
    const bar2 = $('statsFilter');
    const chips = [['all', '🌐 Todos'], ...GAMES.map((g) => [g.key, `${g.emoji} ${g.name}`])];
    bar2.innerHTML = chips.map(([k, n]) => `<button class="stf-chip ${filter === k ? 'sel' : ''}" data-f="${k}">${n}</button>`).join('');
    bar2.querySelectorAll('.stf-chip').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; sfxSafe('click'); renderFilter(); renderStats(); }));
  }
  function detailConquista() {
    const hi = AGG.conq.hiConq || {}, best = AGG.conq.best || {};
    const row = (d, nm) => `<div class="st-line"><span>${nm}</span><b>${hi[d] || 0}/169${best[d] != null ? ' · récord tiempo' : ''}</b></div>`;
    return row('facil', '🌱 Fácil') + row('normal', '⚔️ Normal') + row('dificil', '🔥 Difícil');
  }
  function detailMemoria() {
    const hi = AGG.mem.hi || {};
    const row = (d, nm) => `<div class="st-line"><span>${nm}</span><b>${hi[d] || 0}/169 descubiertos</b></div>`;
    return row('facil', '🌱 Fácil') + row('medio', '⚔️ Medio') + row('dificil', '🔥 Difícil');
  }
  function detailTribunal() {
    const N = AGG.trib.total || 10; const bd = AGG.trib.bestD || {};
    const fila = (d, nm) => { const b = bd[d] || {}; return `<div class="st-line"><span>${nm}</span><b>⚖️ ${b.abogado || 0}/${N} · 👨‍⚖️ ${b.juez || 0}/${N}</b></div>`; };
    return fila('facil', '🌱 Fácil') + fila('medio', '⚔️ Medio') + fila('dificil', '🔥 Difícil');
  }
  function detailTrivial() {
    const pd = AGG.triv.perDiff || {};
    const fila = (d, nm) => { const r = pd[d] || {}; return `<div class="st-line"><span>${nm}</span><b>⭐ ${r.bestWedges || 0}/11 · 🏆 ${r.wins || 0} victoria(s)</b></div>`; };
    return fila('facil', '🌱 Fácil') + fila('medio', '⚔️ Medio') + fila('dificil', '🔥 Difícil');
  }
  function detailIslas() {
    const runs = AGG.isl.runs || {};
    const rango = (r) => { const out = []; for (let n = r[0]; n <= r[1]; n++) out.push(n); return out; };
    const fila = (d, nm) => {
      const owned = (runs[d] || {}).owned || {};
      const done = (typeof TITULOS !== 'undefined')
        ? TITULOS.filter((t) => t.islands.flatMap((is) => rango(is.arts)).every((n) => owned[n])).length : 0;
      return `<div class="st-line"><span>${nm}</span><b>🏝️ ${done}/11 · ${Object.keys(owned).length}/169</b></div>`;
    };
    return fila('facil', '🌱 Fácil') + fila('medio', '⚔️ Medio') + fila('dificil', '🔥 Difícil');
  }

  function renderStats() {
    AGG = agregar();
    const stage = $('statsStage');
    const fr = freshness();
    const ef = effortChart();
    const mastered = Object.keys(AGG.conq.mastered || {}).length;
    let kpiPct, kpiColor, kpiTitle, kpiSub, detail = '';
    if (filter === 'all') {
      kpiPct = dominioGlobal() * 100; kpiColor = 'var(--gold)';
      kpiTitle = 'Dominio de la Constitución';
      kpiSub = 'Media de tu maestría en los 5 juegos, sumando todas tus partidas. El 100% solo se alcanza GANANDO los 5 en su dificultad máxima.';
      detail = `<div class="st-breakdown">${GAMES.map((g) => `
        <div class="st-game"><div class="st-game-head"><span>${g.emoji} ${g.name}</span><b>${Math.round(g.m() * 100)}%</b></div>${bar(g.m() * 100, g.color)}</div>`).join('')}</div>`;
    } else {
      const g = GAMES.find((x) => x.key === filter);
      kpiPct = g.m() * 100; kpiColor = g.color;
      kpiTitle = `Maestría en ${g.name}`;
      kpiSub = 'Cada dificultad es una jugada distinta; el 100% exige ganar en Difícil. Se cuenta lo mejor de todas tus partidas.';
      const det = filter === 'conquista' ? detailConquista() : filter === 'memoria' ? detailMemoria() : filter === 'tribunal' ? detailTribunal() : filter === 'islas' ? detailIslas() : detailTrivial();
      detail = `<div class="st-detail">${det}</div>`;
    }
    stage.innerHTML = `
      <div class="kpi-main">
        <div class="kpi-ring-wrap">${ring(kpiPct, kpiColor)}</div>
        <div class="kpi-text"><div class="kpi-title">${kpiTitle}</div><div class="kpi-sub">${kpiSub}</div>
          <div class="kpi-extra">📚 Artículos vistos con acierto: <b>${mastered}/169</b></div></div>
      </div>
      ${weekCard()}
      ${detail}
      <div class="kpi-card">
        <div class="kpi-card-head"><span>🕒 Frescura de la valoración</span><b style="color:${fr.pct >= 60 ? '#3fbf6f' : fr.pct >= 30 ? 'var(--gold)' : 'var(--danger)'}">${Math.round(fr.pct)}%</b></div>
        ${bar(fr.pct, fr.pct >= 60 ? '#3fbf6f' : fr.pct >= 30 ? '#e0a52e' : '#d24b3e')}
        <div class="kpi-card-foot">${freshLabel(fr.days)} · si dejas de jugar, tu dominio se considera menos actual.</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-head"><span>💪 Esfuerzo (estudio en el tiempo)</span><b>${ef.totalMin} min / 30 días</b></div>
        ${ef.svg}
        <div class="kpi-card-foot">Minutos de estudio por día (últimos 30 días) · ${ef.activeDays} día(s) activos.</div>
      </div>`;
  }

  function openStats(f) {
    filter = f || 'all';
    ['memoria', 'tribunal', 'trivial', 'gameMenu'].forEach((id) => { const el = $(id); if (el && id !== 'gameMenu') el.hidden = true; });
    $('gameMenu').hidden = true;
    renderFilter(); renderStats();
    $('estadisticas').hidden = false;
  }
  window.openStats = openStats;

  const back = $('statsBack');
  if (back) back.addEventListener('click', () => { $('estadisticas').hidden = true; $('gameMenu').hidden = false; sfxSafe('click'); });
  const mb = $('menuStats');
  if (mb) mb.addEventListener('click', () => { sfxSafe('click'); openStats('all'); });
})();
