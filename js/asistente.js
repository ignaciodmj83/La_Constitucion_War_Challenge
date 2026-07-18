/* =========================================================================
   ASISTENTE — "El Sabio", ayudante constante de voz.
   - Botón flotante siempre visible (salta al pulsarlo) en todas las pantallas.
   - Ve en qué pantalla estás y ofrece ayuda contextual (chips de sugerencia).
   - Responde dudas: explica artículos por número, busca conceptos en los 169
     artículos (título + explicación + etiquetas), glosario de términos y
     reglas de cada juego. Todo en local, sin servidores.
   - Voz: responde hablando (síntesis, timbre del Sabio) y escucha con el
     micrófono (Web Speech API) donde el navegador lo soporte.
   Usa ARTICLES, VOZ, TITULOS, ETIQUETAS y, si existen, PERSONAJES/S/sfx.
   ========================================================================= */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const STOP = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en', 'y', 'e', 'o', 'u', 'a', 'al', 'que', 'se', 'es', 'me', 'te', 'mi', 'tu', 'su', 'sus', 'por', 'para', 'con', 'sin', 'como', 'cual', 'cuales', 'sobre', 'este', 'esta', 'esto', 'ese', 'esa', 'eso', 'hay', 'son', 'ser', 'explica', 'explicame', 'dime', 'cuentame', 'quiero', 'saber', 'significa', 'quien', 'donde', 'cuando', 'cuanto', 'cuantos', 'articulo', 'articulos', 'constitucion']);

  /* ── qué pantalla está viendo el usuario ── */
  function pantalla() {
    const menu = $('gameMenu');
    if (menu && !menu.hidden) return 'menu';
    for (const id of ['islas', 'memoria', 'tribunal', 'trivial', 'estudio', 'estadisticas']) {
      const e = $(id); if (e && !e.hidden) return id;
    }
    return 'conquista';
  }
  const AYUDA = {
    menu: 'Estás en el menú principal. Hay cinco juegos: Conquista (mapa tipo Risk), Memorión (adivina de qué trata cada número), Tribunal (haz de abogado o juez), Trivial (tablero de quesitos) e Islas (aventura isla a isla). Abajo tienes Estudiar y Estadísticas, y arriba a la derecha, tu cuenta.',
    conquista: 'Estás en la Conquista. Pulsa un territorio con brillo dorado y responde su pregunta para conquistarlo. Cada título tiene su profesor, que te prepara antes de la batalla. Ojo con El Olvido: si no repasas, tus títulos se debilitan. La dificultad se cambia con el botón de la espada, y cada dificultad es una partida distinta.',
    islas: 'Estás en Islas. Avanza isla a isla en orden: entra en la isla desbloqueada, conquista sus territorios uno a uno respondiendo preguntas y, al completarla, se abre la siguiente. En Medio tienes 25 segundos y 3 vidas por isla; en Difícil, 15 segundos y 1 vida. ¡Llega a La Unidad de España!',
    memoria: 'Estás en el Memorión. Pulsa un número y elige de qué trata ese artículo. Si aciertas, la carta queda descubierta. En Fácil tienes 3 fallos permitidos; en Difícil no puedes fallar.',
    tribunal: 'Estás en el Tribunal. Van pasando casos reales: como abogado eliges el mejor alegato y como juez dictas el fallo correcto. En Difícil no se muestran los artículos de pista.',
    trivial: 'Estás en el Trivial. Tira el dado, recorre la rueda y captura los 11 quesitos respondiendo en las casillas con estrella. Con todos los quesitos, ve al centro y supera la prueba final para ganar.',
    estudio: 'Estás en la zona de estudio. Elige a un guardián del Consejo Constituyente y repasa los artículos de su título; cada tarjeta abre el texto completo, que también puedo leerte en voz alta.',
    estadisticas: 'Estás en Estadísticas. El Dominio es la media de tu maestría en los cinco juegos: el cien por cien solo se alcanza ganándolos todos en dificultad máxima. También ves tu media diaria de juego de la última semana.',
  };
  const CHIPS = {
    menu: ['¿Qué juego me recomiendas?', 'Explícame el artículo 1', '¿Cómo funcionan las dificultades?'],
    conquista: ['¿Cómo se juega aquí?', '¿Qué es El Olvido?', 'Explícame el artículo 14'],
    islas: ['¿Cómo se juega aquí?', '¿Cómo funcionan las vidas?', 'Explícame el artículo 15'],
    memoria: ['¿Cómo se juega aquí?', 'Trucos para memorizar', 'Explícame el artículo 27'],
    tribunal: ['¿Cómo se juega aquí?', '¿Qué es el habeas corpus?', '¿Qué es el recurso de amparo?'],
    trivial: ['¿Cómo se juega aquí?', '¿Cómo gano un quesito?', 'Explícame el artículo 66'],
    estudio: ['Léeme el artículo 10', '¿Qué título habla de los derechos?', '¿Quién es el Rey según la Constitución?'],
    estadisticas: ['¿Cómo llego al 100%?', '¿Qué es la frescura?', '¿Qué es el dominio?'],
  };

  /* ── glosario de conceptos y reglas ── */
  const GLOSARIO = [
    { k: ['habeas corpus'], r: 'El habeas corpus es un procedimiento urgente para que un juez revise inmediatamente si una detención es legal. Lo garantiza el artículo 17: nadie puede estar detenido más de 72 horas sin pasar a disposición judicial.' },
    { k: ['recurso de amparo', 'amparo'], r: 'El recurso de amparo es la vía para pedir al Tribunal Constitucional que proteja tus derechos fundamentales cuando han sido vulnerados. Lo prevé el artículo 53.2, junto al procedimiento preferente y sumario ante los tribunales ordinarios.' },
    { k: ['mocion de censura', 'censura'], r: 'La moción de censura (artículo 113) permite al Congreso cambiar al presidente del Gobierno, pero es constructiva: debe incluir un candidato alternativo. Así nunca queda el país sin gobierno.' },
    { k: ['cuestion de confianza', 'confianza'], r: 'Con la cuestión de confianza (artículo 112) el presidente pregunta al Congreso si sigue teniendo su apoyo sobre su programa o una declaración de política general. Si la pierde, debe dimitir.' },
    { k: ['olvido'], r: 'El Olvido es una mecánica de la Conquista: con el paso de las horas tus títulos conquistados se debilitan y pueden rebelarse. Vuelve cada día y defiéndelos respondiendo sus preguntas para mantenerlos.' },
    { k: ['vidas', 'vida', 'corazones'], r: 'En Islas, cada dificultad tiene sus reglas: en Fácil no hay límite; en Medio tienes 3 vidas por isla y 25 segundos por pregunta; en Difícil, 1 vida y 15 segundos. Si te quedas sin vidas, esa isla se reinicia y toca reconquistarla.' },
    { k: ['quesito', 'quesitos'], r: 'En el Trivial, los quesitos se ganan acertando la pregunta en las casillas grandes con estrella: una por título, 11 en total. Con todos los quesitos, ve al centro de la rueda y supera la prueba final para ganar.' },
    { k: ['dificultad', 'dificultades', 'niveles'], r: 'Cada juego tiene tres niveles: Fácil, Medio y Difícil, y cada nivel es una partida independiente con su propio progreso. Para el cien por cien de dominio hay que ganar los cinco juegos en Difícil.' },
    { k: ['dominio'], r: 'El Dominio, en Estadísticas, es la media de tu maestría en los cinco juegos. Cada nivel de dificultad pondera distinto (Fácil 60%, Medio 80%, Difícil 100%), así que el cien por cien exige ganarlo todo en Difícil.' },
    { k: ['frescura'], r: 'La frescura, en Estadísticas, mide lo reciente que es tu valoración: si dejas de jugar unos días, tu dominio se considera menos actual y la frescura baja. Se recupera jugando.' },
    { k: ['100', 'cien por cien'], r: 'Para alcanzar el 100% de Dominio tienes que ganar los cinco juegos en su dificultad máxima: conquistar los 169 territorios de la Conquista y de las Islas en Difícil, descubrir los 169 del Memorión sin fallar, resolver todos los casos del Tribunal como abogado y como juez, y ganar el Trivial en Difícil.' },
    { k: ['unidad de espana', 'unidad'], r: 'La Unidad de España es la figura final del juego de Islas: la meta del viaje. Se alcanza completando las 11 islas de los títulos en orden. En la Constitución, la unidad de la Nación aparece en el artículo 2, junto a la autonomía de nacionalidades y regiones.' },
    { k: ['memorizar', 'trucos', 'memoria'], r: 'Un buen truco: asocia cada número a su símbolo del Memorión y repasa por bloques (los títulos). Los artículos estrella tienen explicación hablada: escúchalos en la zona de Estudiar. Y mejor 10 minutos cada día que una hora un solo día: la media diaria sale en Estadísticas.' },
    { k: ['cuenta', 'usuario', 'contrasena', 'partida', 'partidas'], r: 'En Mi cuenta (arriba a la derecha del menú) puedes cambiar tu nombre, poner o cambiar la contraseña, gestionar tus partidas (crear, abrir o eliminar), ajustar preferencias y cambiar de usuario.' },
    { k: ['recomiendas', 'recomendacion', 'empiezo', 'empezar'], r: 'Si empiezas, te recomiendo Islas en Fácil: avanzas título a título en orden, que es como está pensada la Constitución. Luego, el Memorión para fijar los números, y cuando domines, la Conquista en Difícil es el gran reto.' },
  ];

  /* ── buscador de artículos por concepto ── */
  function tokens(q) { return norm(q).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !STOP.has(w)); }
  function buscaArticulos(q) {
    const tks = tokens(q); if (!tks.length) return [];
    const scores = [];
    for (let n = 1; n <= 169; n++) {
      const a = ARTICLES[n]; if (!a) continue;
      const t = norm(a.t), e = norm(a.e);
      const et = (typeof ETIQUETAS !== 'undefined' && ETIQUETAS[n]) ? norm(ETIQUETAS[n]) : '';
      let s = 0;
      for (const w of tks) { if (t.includes(w)) s += 4; if (et.includes(w)) s += 3; if (e.includes(w)) s += 1; }
      if (s > 0) scores.push([s, n]);
    }
    scores.sort((x, y) => y[0] - x[0]);
    return scores.slice(0, 3).map(([, n]) => n);
  }
  function explicaArticulo(n) {
    const a = ARTICLES[n]; if (!a) return null;
    const rich = (typeof VOZ !== 'undefined') && VOZ[n];
    const tid = (typeof MAP !== 'undefined') ? MAP.art.titulo[n] : null;
    const t = tid && (typeof TITULOS !== 'undefined') ? TITULOS.find((x) => x.id === tid) : null;
    const marco = t ? (t.roman ? ` (Título ${t.roman}, ${t.name})` : ` (${t.name})`) : '';
    return `Artículo ${n}${marco}: ${a.t}. ${rich ? VOZ[n] : a.e}`;
  }

  /* ── el cerebro: de pregunta a respuesta ── */
  function responde(q) {
    const nq = norm(q);
    // 1) artículo por número ("artículo 15", "el 15", "léeme el 27")
    const mArt = nq.match(/(?:art[íi]?c?u?l?o?|art)\.?\s*(\d{1,3})/) || nq.match(/\b(?:el|lee|leeme|léeme)\s+(\d{1,3})\b/) || (/^\s*\d{1,3}\s*$/.test(nq) ? [null, nq.trim()] : null);
    if (mArt) {
      const n = parseInt(mArt[1], 10);
      if (n >= 1 && n <= 169) return { txt: explicaArticulo(n), n };
      return { txt: 'La Constitución tiene 169 artículos: pídeme uno entre el 1 y el 169.' };
    }
    // 2) ayuda de la pantalla actual
    if (/(como se juega|que hago|ayuda|no entiendo|que es esto|como funciona (esto|aqui))/.test(nq)) {
      return { txt: AYUDA[pantalla()] };
    }
    // 3) glosario de conceptos y reglas
    for (const g of GLOSARIO) if (g.k.some((k) => nq.includes(k))) return { txt: g.r };
    // 4) búsqueda por concepto en los 169 artículos
    const hits = buscaArticulos(q);
    if (hits.length) {
      const extra = hits.length > 1 ? ` También te pueden interesar los artículos ${hits.slice(1).join(' y ')}.` : '';
      return { txt: explicaArticulo(hits[0]) + extra, n: hits[0] };
    }
    return { txt: 'No he encontrado eso. Prueba a preguntarme por un artículo («explícame el artículo 15»), un concepto («¿qué es el habeas corpus?») o por cómo se juega en esta pantalla.' };
  }

  /* ── voz: hablar y escuchar ── */
  let hablando = null;
  function habla(texto) {
    try {
      if (typeof S !== 'undefined' && S.voice === false) return;
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'es-ES'; u.rate = 0.92; u.pitch = 0.75; // timbre del Sabio
      if (typeof pickVoice === 'function') { const v = pickVoice('m'); if (v) u.voice = v; }
      hablando = u; speechSynthesis.speak(u);
    } catch { /* */ }
  }
  const calla = () => { try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch { /* */ } };

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, escuchando = false;
  function toggleMic() {
    if (!SR) return;
    if (escuchando) { try { rec.stop(); } catch { /* */ } return; }
    rec = new SR(); rec.lang = 'es-ES'; rec.interimResults = false; rec.maxAlternatives = 1;
    const micBtn = $('asisMic');
    rec.onstart = () => { escuchando = true; micBtn.classList.add('on'); };
    rec.onend = () => { escuchando = false; micBtn.classList.remove('on'); };
    rec.onerror = () => { escuchando = false; micBtn.classList.remove('on'); };
    rec.onresult = (e) => {
      const txt = e.results[0][0].transcript;
      $('asisInput').value = txt; enviar();
    };
    try { rec.start(); } catch { /* */ }
  }

  /* ── interfaz ── */
  let abierto = false;
  function ui() {
    const fab = document.createElement('button');
    fab.id = 'asisFab'; fab.title = 'Pregúntale al Sabio';
    fab.innerHTML = `<img src="assets/personajes/preliminar.png" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🧙'}))"><span class="asis-fab-badge">?</span>`;
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.id = 'asisPanel'; panel.hidden = true;
    panel.innerHTML = `
      <div class="asis-head">
        <img class="asis-ava" src="assets/personajes/preliminar.png" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🧙',className:'asis-ava-fb'}))">
        <div class="asis-meta"><b>El Sabio</b><small>tu ayudante de la Constitución</small></div>
        <button id="asisVoz" class="asis-ic" title="Voz del asistente">🔊</button>
        <button id="asisCerrar" class="asis-ic" title="Cerrar">✕</button>
      </div>
      <div id="asisMsgs" class="asis-msgs"></div>
      <div id="asisChips" class="asis-chips"></div>
      <div class="asis-inrow">
        <input id="asisInput" type="text" placeholder="Pregúntame lo que quieras…" autocomplete="off">
        ${SR ? '<button id="asisMic" class="asis-ic" title="Hablar">🎤</button>' : ''}
        <button id="asisSend" class="asis-ic asis-send" title="Enviar">➤</button>
      </div>`;
    document.body.appendChild(panel);

    fab.addEventListener('click', () => { abierto ? cierra() : abre(); });
    $('asisCerrar').addEventListener('click', cierra);
    $('asisSend').addEventListener('click', enviar);
    $('asisInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });
    if (SR) $('asisMic').addEventListener('click', toggleMic);
    let vozOn = true;
    $('asisVoz').addEventListener('click', () => { vozOn = !vozOn; $('asisVoz').textContent = vozOn ? '🔊' : '🔇'; if (!vozOn) calla(); panel.dataset.voz = vozOn ? '1' : '0'; });
    panel.dataset.voz = '1';
  }
  function msg(quien, texto) {
    const box = $('asisMsgs');
    const d = document.createElement('div');
    d.className = 'asis-msg ' + quien;
    d.textContent = texto;
    box.appendChild(d); box.scrollTop = box.scrollHeight;
  }
  function chips() {
    const c = $('asisChips'); const p = pantalla();
    c.innerHTML = (CHIPS[p] || CHIPS.menu).map((t) => `<button class="asis-chip">${t}</button>`).join('');
    c.querySelectorAll('.asis-chip').forEach((b) => b.addEventListener('click', () => { $('asisInput').value = b.textContent; enviar(); }));
  }
  function abre() {
    abierto = true; $('asisPanel').hidden = false; $('asisFab').classList.add('open');
    const p = pantalla();
    const box = $('asisMsgs');
    if (!box.childElementCount) {
      msg('sabio', '¡Hola! Soy El Sabio 📜. ' + AYUDA[p]);
      if ($('asisPanel').dataset.voz === '1') habla('¡Hola! Soy El Sabio. Pregúntame lo que quieras sobre la Constitución o sobre esta pantalla.');
    } else {
      msg('sabio', AYUDA[p]);
    }
    chips();
    try { $('asisInput').focus(); } catch { /* */ }
  }
  function cierra() { abierto = false; $('asisPanel').hidden = true; $('asisFab').classList.remove('open'); calla(); }
  function enviar() {
    const inp = $('asisInput'); const q = inp.value.trim(); if (!q) return;
    inp.value = '';
    msg('yo', q);
    const r = responde(q);
    msg('sabio', r.txt);
    if ($('asisPanel').dataset.voz === '1') habla(r.txt);
    try { if (typeof sfx !== 'undefined' && sfx.click) sfx.click(); } catch { /* */ }
  }

  document.addEventListener('DOMContentLoaded', ui);
  window.ASISTENTE = { responde, pantalla };
})();
