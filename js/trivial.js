/* =========================================================================
   Juego 4: "Trivial" de la Constitución.
   Preguntas tipo test (las de los 169 artículos). Rondas de 12 preguntas al
   azar; puntúas por acierto y por racha, con explicación al responder.
   Acertar marca el artículo como estudiado (suma a la "Preparación").
   Comparte utilidades globales de game.js (S, sfx, toast, confetti, save).
   ========================================================================= */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const sfxSafe = (k) => { try { if (typeof sfx !== 'undefined' && sfx[k]) sfx[k](); } catch { /* */ } };
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const RONDA = 12;
  const KEY = 'ce78_trivial_v1';
  let best = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || { best: 0 }; } catch { return { best: 0 }; } })();
  function saveBest() { try { localStorage.setItem(KEY, JSON.stringify(best)); } catch { /* */ } }

  let TV = { order: [], i: 0, score: 0, streak: 0, correct: 0, answered: false };

  function markMastered(n) {
    try { if (typeof S !== 'undefined') { S.stats.mastered = S.stats.mastered || {}; S.stats.mastered[n] = true; if (typeof save === 'function') save(); } } catch { /* */ }
  }
  function newRun() {
    TV.order = shuffle(Array.from({ length: 169 }, (_, k) => k + 1)).slice(0, RONDA);
    TV.i = 0; TV.score = 0; TV.streak = 0; TV.correct = 0;
  }
  function updateHud() {
    $('trivScore').textContent = `⭐ ${TV.score}${TV.streak >= 2 ? '  🔥×' + TV.streak : ''}`;
    $('trivProg').textContent = `${Math.min(TV.i + 1, RONDA)}/${RONDA}`;
  }
  function renderQ() {
    const n = TV.order[TV.i]; const a = ARTICLES[n]; TV.answered = false;
    updateHud();
    const order = shuffle(a.o.map((_, k) => k));
    $('trivStage').innerHTML = `
      <div class="trib-case">
        <div class="tc-arts"><span class="tc-art">Pregunta ${TV.i + 1}</span></div>
        <div class="tc-q">${a.q}</div>
        <div class="tc-options" id="tvOptions"></div>
        <div class="tc-feedback" id="tvFeedback" hidden></div>
      </div>`;
    const box = $('tvOptions');
    order.forEach((oi) => {
      const b = document.createElement('button'); b.className = 'tc-opt'; b.textContent = a.o[oi]; b.dataset.oi = oi;
      b.addEventListener('click', () => answer(oi, n, a, box));
      box.appendChild(b);
    });
  }
  function answer(oi, n, a, box) {
    if (TV.answered) return; TV.answered = true;
    const correct = oi === a.c;
    [...box.children].forEach((ch) => {
      ch.disabled = true;
      if (+ch.dataset.oi === a.c) ch.classList.add('ok');
      else if (+ch.dataset.oi === oi) ch.classList.add('bad');
    });
    if (correct) {
      TV.correct++; TV.streak++; TV.score += 10 + Math.min(TV.streak - 1, 5) * 2;
      sfxSafe('correct'); markMastered(n);
    } else { TV.streak = 0; sfxSafe('wrong'); }
    updateHud();
    const fb = $('tvFeedback'); fb.hidden = false; fb.className = 'tc-feedback ' + (correct ? 'ok' : 'bad');
    fb.innerHTML = `
      <div class="fb-verdict">${correct ? '✅ ¡Correcto!' : '❌ Incorrecto'} <span class="fb-ref">Art. ${n} · ${a.t}</span></div>
      <div class="fb-why">${a.e}</div>
      <button id="tvNext" class="primary-btn">${TV.i >= RONDA - 1 ? 'Ver resultado 🏆' : 'Siguiente ➜'}</button>`;
    $('tvNext').addEventListener('click', () => { if (TV.i >= RONDA - 1) summary(); else { TV.i++; renderQ(); } });
    $('tvNext').focus();
  }
  function summary() {
    const record = TV.score > best.best;
    if (record) { best.best = TV.score; saveBest(); }
    const rank = TV.correct >= 11 ? '🏆 Constitucionalista' : TV.correct >= 8 ? '🎖️ Buen/a jurista' : TV.correct >= 5 ? '📚 Aprobado/a' : '🌱 A seguir estudiando';
    $('trivStage').innerHTML = `
      <div class="trib-case trib-summary">
        <div class="ts-emoji">❓</div>
        <h2>${rank}</h2>
        <p class="ts-score">Has acertado <b>${TV.correct}</b> de <b>${RONDA}</b> · <b>${TV.score}</b> puntos${record ? ' 🎉 ¡Récord!' : ` · récord: ${best.best}`}</p>
        <div class="ts-actions">
          <button id="tvAgain" class="primary-btn">Otra ronda ❓</button>
          <button id="tvToMenu" class="secondary-btn">Volver al menú</button>
        </div>
      </div>`;
    if (TV.correct >= 11) { try { if (typeof confetti === 'function') confetti(); } catch { /* */ } }
    $('tvAgain').addEventListener('click', () => { newRun(); renderQ(); });
    $('tvToMenu').addEventListener('click', backToMenu);
  }
  function backToMenu() { $('trivial').hidden = true; $('gameMenu').hidden = false; sfxSafe('click'); }

  function startTrivial() { $('gameMenu').hidden = true; newRun(); renderQ(); $('trivial').hidden = false; }
  window.startTrivial = startTrivial;

  const back = $('trivBack');
  if (back) back.addEventListener('click', backToMenu);
})();
