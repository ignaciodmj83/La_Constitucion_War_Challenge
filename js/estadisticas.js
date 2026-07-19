/* =========================================================================
   Estadísticas unificadas (accesibles desde el menú principal).
   Dos bloques bien separados:
     1) ESTADÍSTICAS DE LA PARTIDA — cómo de bueno eres en cada juego EN LA
        PARTIDA ACTIVA (la que está abierta ahora). Cambiar de partida
        cambia estas cifras, porque cada partida es un mundo aparte.
     2) DEDICACIÓN PERSONAL — cuánto tiempo dedicas a la app cada día,
        sumando TODAS las partidas de la cuenta (media diaria, curva de 30
        días y frescura). Esto es del usuario, no de una partida.
   ========================================================================= */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const sfxSafe = (k) => { try { if (typeof sfx !== 'undefined' && sfx[k]) sfx[k](); } catch { /* */ } };
  const pget = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
  const Sstats = () => (typeof S !== 'undefined' && S.stats) ? S.stats : (pget('ce78_warchallenge_v3').stats || {});
  const WD = { facil: 0.6, normal: 0.8, medio: 0.8, dificil: 1.0 };

  /* ── maestría por juego (0..1) DE LA PARTIDA ACTIVA; 1.0 solo a máxima dificultad ── */
  function mConquista() { const hi = Sstats().hiConq || {}; let m = 0; ['facil', 'normal', 'dificil'].forEach((d) => { m = Math.max(m, ((hi[d] || 0) / 169) * WD[d]); }); return m; }
  function mMemoria() { const o = pget('ce78_memoria_v2'); const hi = o.hi || {}; let m = 0; ['facil', 'medio', 'dificil'].forEach((d) => { m = Math.max(m, ((hi[d] || 0) / 169) * WD[d]); }); return m; }
  function mTribunal() {
    const o = pget('ce78_tribunal_v1'); const N = o.total || 10; let m = 0;
    const prog = (b) => ((Math.min(b.abogado || 0, N) / N) + (Math.min(b.juez || 0, N) / N)) / 2;
    if (o.bestD) for (const d of Object.keys(o.bestD)) m = Math.max(m, prog(o.bestD[d]) * (WD[d] || 0.8));
    else if (o.best) m = prog(o.best) * 0.8; // datos antiguos sin dificultad: tope Medio
    return m;
  }
  function mTrivial() {
    const o = pget('ce78_trivial_v1'); let m = 0;
    const pd = o.perDiff || (o.bestWedges != null ? { medio: { bestWedges: o.bestWedges, wins: o.wins || 0 } } : {});
    for (const d of Object.keys(pd)) {
      const r = pd[d] || {};
      const prog = (r.wins || 0) > 0 ? 1 : Math.min(1, (r.bestWedges || 0) / 11) * 0.9; // solo GANAR da el 100% del nivel
      m = Math.max(m, prog * (WD[d] || 0.8));
    }
    return m;
  }
  function mIslas() {
    const o = pget('ce78_islas_v1'); let m = 0;
    const runs = o.runs || (o.owned ? { [WD[o.diff] ? o.diff : 'medio']: { owned: o.owned } } : {});
    for (const d of Object.keys(runs)) m = Math.max(m, (Object.keys((runs[d] || {}).owned || {}).length / 169) * (WD[d] || 0.8));
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

  /* ── DEDICACIÓN PERSONAL: tiempo por día sumando TODAS las partidas ──
     El contador de tiempo vive dentro del estado de Conquista de cada
     partida (stats.days / lastActive). La partida activa se lee en vivo (S)
     y las demás desde sus datos guardados en la cuenta; se salta la copia
     guardada de la activa para no contarla dos veces. */
  function tiempoPersonal() {
    const days = {}; let lastActive = 0;
    const suma = (st) => {
      if (!st) return;
      for (const k of Object.keys(st.days || {})) days[k] = (days[k] || 0) + st.days[k];
      lastActive = Math.max(lastActive, st.lastActive || 0);
    };
    suma(Sstats());
    try {
      const actId = (typeof CUENTA !== 'undefined' && CUENTA.partidaActivaId) ? CUENTA.partidaActivaId() : null;
      const partidas = (typeof CUENTA !== 'undefined' && CUENTA.todasLasPartidas) ? CUENTA.todasLasPartidas() : [];
      for (const p of partidas) {
        if (!p || p.id === actId || !p.data || !p.data['ce78_warchallenge_v3']) continue;
        try { suma((JSON.parse(p.data['ce78_warchallenge_v3']) || {}).stats); } catch { /* */ }
      }
    } catch { /* */ }
    return { days, lastActive };
  }

  function freshness(lastActive) {
    if (!lastActive) return { pct: 0, days: null };
    const days = (Date.now() - lastActive) / 86400000;
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

  const fmtMin = (min) => {
    if (min >= 60) { const h = Math.floor(min / 60), m = Math.round(min % 60); return m ? `${h} h ${m} min` : `${h} h`; }
    return min >= 10 ? `${Math.round(min)} min` : `${min.toFixed(1)} min`;
  };

  function lastDays(n, daysMap) {
    const out = []; const base = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(base); d.setDate(base.getDate() - i);
      const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      out.push({ dom: d.getDate(), month: d.getMonth() + 1, dow: d.getDay(), min: (daysMap[k] || 0) / 60000 });
    }
    return out;
  }

  /* ── media de juego diario de la última semana (7 días, ceros incluidos) ── */
  const DOW = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  function weekCard(daysMap) {
    const days = lastDays(7, daysMap);
    const total = days.reduce((s, d) => s + d.min, 0);
    const media = total / 7;
    const max = Math.max(10, ...days.map((d) => d.min));
    const bars = days.map((d) => `
      <div class="wk-day" title="${d.dom}/${d.month}: ${Math.round(d.min)} min">
        <div class="wk-bar"><div class="wk-fill ${d.min > 0 ? '' : 'cero'}" style="height:${Math.max(4, (d.min / max) * 100)}%"></div></div>
        <span class="wk-lbl">${DOW[d.dow]}</span>
      </div>`).join('');
    return `<div class="kpi-card kpi-week">
      <div class="kpi-card-head"><span>📅 Media diaria · última semana</span><b class="wk-media">${fmtMin(media)}/día</b></div>
      <div class="wk-bars">${bars}</div>
      <div class="kpi-card-foot">Total de la semana: ${fmtMin(total)} · ${days.filter((d) => d.min > 0).length} de 7 días con actividad.</div>
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
  function effortChart(daysMap) {
    const N = 30, days = lastDays(N, daysMap);
    const W = 320, H = 130, padL = 4, padR = 4, padT = 10, padB = 20;
    const maxMin = Math.max(10, ...days.map((d) => d.min));
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const pts = days.map((d, i) => [padL + (i / (N - 1)) * plotW, padT + plotH - (d.min / maxMin) * plotH]);
    const line = smoothPath(pts);
    const area = line + ` L ${pts[pts.length - 1][0].toFixed(1)} ${(padT + plotH).toFixed(1)} L ${pts[0][0].toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
    let xlab = '';
    for (let i = 0; i < N; i += 7) xlab += `<text x="${pts[i][0].toFixed(1)}" y="${H - 5}" class="ef-x">${days[i].dom}/${days[i].month}</text>`;
    const totalMin = days.reduce((s, d) => s + d.min, 0);
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
    const hi = Sstats().hiConq || {}, best = Sstats().best || {};
    const row = (d, nm) => `<div class="st-line"><span>${nm}</span><b>${hi[d] || 0}/169${best[d] != null ? ' · récord tiempo' : ''}</b></div>`;
    return row('facil', '🌱 Fácil') + row('normal', '⚔️ Normal') + row('dificil', '🔥 Difícil');
  }
  function detailMemoria() {
    const hi = pget('ce78_memoria_v2').hi || {};
    const row = (d, nm) => `<div class="st-line"><span>${nm}</span><b>${hi[d] || 0}/169 descubiertos</b></div>`;
    return row('facil', '🌱 Fácil') + row('medio', '⚔️ Medio') + row('dificil', '🔥 Difícil');
  }
  function detailTribunal() {
    const o = pget('ce78_tribunal_v1'); const N = o.total || 10; const bd = o.bestD || {};
    const fila = (d, nm) => { const b = bd[d] || {}; return `<div class="st-line"><span>${nm}</span><b>⚖️ ${b.abogado || 0}/${N} · 👨‍⚖️ ${b.juez || 0}/${N}</b></div>`; };
    return fila('facil', '🌱 Fácil') + fila('medio', '⚔️ Medio') + fila('dificil', '🔥 Difícil');
  }
  function detailTrivial() {
    const o = pget('ce78_trivial_v1'); const pd = o.perDiff || {};
    const fila = (d, nm) => { const r = pd[d] || {}; return `<div class="st-line"><span>${nm}</span><b>⭐ ${r.bestWedges || 0}/11 · 🏆 ${r.wins || 0} victoria(s)</b></div>`; };
    return fila('facil', '🌱 Fácil') + fila('medio', '⚔️ Medio') + fila('dificil', '🔥 Difícil');
  }
  function detailIslas() {
    const o = pget('ce78_islas_v1');
    const runs = o.runs || (o.owned ? { medio: { owned: o.owned } } : {});
    const rango = (r) => { const out = []; for (let n = r[0]; n <= r[1]; n++) out.push(n); return out; };
    const fila = (d, nm) => {
      const owned = (runs[d] || {}).owned || {};
      const done = (typeof TITULOS !== 'undefined')
        ? TITULOS.filter((t) => t.islands.flatMap((is) => rango(is.arts)).every((n) => owned[n])).length : 0;
      return `<div class="st-line"><span>${nm}</span><b>🏝️ ${done}/11 · ${Object.keys(owned).length}/169</b></div>`;
    };
    return fila('facil', '🌱 Fácil') + fila('medio', '⚔️ Medio') + fila('dificil', '🔥 Difícil');
  }

  const esc = (s) => String(s).replace(/</g, '&lt;');

  function renderStats() {
    const stage = $('statsStage');
    const T = tiempoPersonal();
    const fr = freshness(T.lastActive);
    const ef = effortChart(T.days);
    const mastered = Object.keys(Sstats().mastered || {}).length;
    const pNombre = (typeof CUENTA !== 'undefined' && CUENTA.partidaActivaNombre) ? CUENTA.partidaActivaNombre() : '';
    const uNombre = (typeof CUENTA !== 'undefined' && CUENTA.user && CUENTA.user()) ? CUENTA.user().name : '';

    let kpiPct, kpiColor, kpiTitle, kpiSub, detail = '';
    if (filter === 'all') {
      kpiPct = dominioGlobal() * 100; kpiColor = 'var(--gold)';
      kpiTitle = 'Dominio de la Constitución';
      kpiSub = 'Media de tu maestría en los 5 juegos en esta partida. El 100% solo se alcanza GANANDO los 5 en su dificultad máxima.';
      detail = `<div class="st-breakdown">${GAMES.map((g) => `
        <div class="st-game"><div class="st-game-head"><span>${g.emoji} ${g.name}</span><b>${Math.round(g.m() * 100)}%</b></div>${bar(g.m() * 100, g.color)}</div>`).join('')}</div>`;
    } else {
      const g = GAMES.find((x) => x.key === filter);
      kpiPct = g.m() * 100; kpiColor = g.color;
      kpiTitle = `Maestría en ${g.name}`;
      kpiSub = 'Cada dificultad es una jugada distinta; el 100% exige ganar en Difícil.';
      const det = filter === 'conquista' ? detailConquista() : filter === 'memoria' ? detailMemoria() : filter === 'tribunal' ? detailTribunal() : filter === 'islas' ? detailIslas() : detailTrivial();
      detail = `<div class="st-detail">${det}</div>`;
    }
    stage.innerHTML = `
      <div class="stats-sec">🎮 Estadísticas de la partida${pNombre ? ` · «${esc(pNombre)}»` : ''}
        <small>Cada partida tiene las suyas: si cambias de partida en Mi cuenta, cambian estas cifras.</small></div>
      <div class="kpi-main">
        <div class="kpi-ring-wrap">${ring(kpiPct, kpiColor)}</div>
        <div class="kpi-text"><div class="kpi-title">${kpiTitle}</div><div class="kpi-sub">${kpiSub}</div>
          <div class="kpi-extra">📚 Artículos vistos con acierto: <b>${mastered}/169</b></div></div>
      </div>
      ${detail}
      <div class="stats-sec">👤 Tu dedicación personal${uNombre ? ` · ${esc(uNombre)}` : ''}
        <small>Tiempo de uso de la app por día, sumando todas las partidas de tu cuenta.</small></div>
      ${weekCard(T.days)}
      <div class="kpi-card">
        <div class="kpi-card-head"><span>💪 Esfuerzo (estudio en el tiempo)</span><b>${fmtMin(ef.totalMin)} / 30 días</b></div>
        ${ef.svg}
        <div class="kpi-card-foot">Tiempo de estudio por día (últimos 30 días) · ${ef.activeDays} día(s) activos.</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-head"><span>🕒 Frescura de la valoración</span><b style="color:${fr.pct >= 60 ? '#3fbf6f' : fr.pct >= 30 ? 'var(--gold)' : 'var(--danger)'}">${Math.round(fr.pct)}%</b></div>
        ${bar(fr.pct, fr.pct >= 60 ? '#3fbf6f' : fr.pct >= 30 ? '#e0a52e' : '#d24b3e')}
        <div class="kpi-card-foot">${freshLabel(fr.days)} · si dejas de jugar, tu dominio se considera menos actual.</div>
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
