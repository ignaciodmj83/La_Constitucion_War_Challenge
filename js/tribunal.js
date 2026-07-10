/* =========================================================================
   Juego 3: "Tribunal" — simulación del Tribunal Constitucional.
   Van pasando casos. En dos versiones:
     - ⚖️ Abogado: defiendes o acusas; eliges el mejor alegato (lo que diría
       un buen letrado), fundado en la Constitución.
     - 👨‍⚖️ Juez: dictas el fallo (veredicto + fundamento) correcto.
   Cada caso está anclado a artículos reales; acertar marca esos artículos como
   estudiados (suma a la "Preparación"). Contenido divulgativo, sin citar
   números de sentencia.
   Comparte utilidades globales de game.js (S, sfx, toast, confetti, save).
   ========================================================================= */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const sfxSafe = (k) => { try { if (typeof sfx !== 'undefined' && sfx[k]) sfx[k](); } catch { /* */ } };
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ── Casos (abogado + juez, con una opción correcta cada uno) ── */
  const CASOS = [
    {
      titulo: 'La bolsa de empleo por edad', arts: [14],
      hechos: 'Un ayuntamiento crea una bolsa de empleo que excluye a las personas mayores de 45 años, sin que el puesto lo justifique.',
      rolAbogado: 'Defiendes a una aspirante excluida por su edad.',
      abogado: {
        q: '¿Cuál es tu mejor alegato ante el Tribunal?',
        o: [
          { t: 'La exclusión por edad vulnera la igualdad del art. 14, al no haber justificación objetiva y razonable.', ok: true, por: 'El art. 14 prohíbe discriminar por cualquier circunstancia personal salvo justificación objetiva, razonable y proporcionada.' },
          { t: 'El ayuntamiento puede poner los requisitos que quiera por su autonomía local.', ok: false, por: 'La autonomía local no permite vulnerar derechos fundamentales como la igualdad.' },
          { t: 'La edad no aparece en el art. 14, así que no cabe hablar de discriminación.', ok: false, por: 'El art. 14 cierra con "cualquier otra condición o circunstancia personal o social", y la edad lo es.' },
        ],
      },
      juez: {
        q: 'Como magistrado/a, ¿cuál es tu fallo?',
        o: [
          { t: 'Estimo el recurso: la exclusión es inconstitucional por vulnerar el art. 14.', ok: true, por: 'No hay justificación ligada al puesto; la diferencia de trato por edad es discriminatoria.' },
          { t: 'Desestimo: la igualdad no rige en el acceso al empleo público.', ok: false, por: 'El acceso a funciones y cargos públicos debe respetar la igualdad (arts. 14 y 23.2).' },
          { t: 'Estimación parcial: solo si la afectada supera los 60 años.', ok: false, por: 'El vicio está en el criterio en sí, no en la edad concreta de quien recurre.' },
        ],
      },
    },
    {
      titulo: 'El reportaje incómodo', arts: [20, 18],
      hechos: 'Un periódico publica una investigación veraz sobre la gestión de un alto cargo, que se querella por intromisión en su honor.',
      rolAbogado: 'Defiendes al periódico.',
      abogado: {
        q: '¿Qué alegas en defensa del medio?',
        o: [
          { t: 'La información es veraz y de interés público: prevalece la libertad de información del art. 20.', ok: true, por: 'Con información veraz y sobre asunto de interés público, la libertad de información suele prevalecer sobre el honor de los cargos.' },
          { t: 'El honor del art. 18 siempre está por encima de la libertad de prensa.', ok: false, por: 'No hay jerarquía automática: se ponderan, y la veracidad y el interés público pesan mucho.' },
          { t: 'La libertad de expresión permite publicar cualquier cosa, sea verdad o mentira.', ok: false, por: 'El art. 20 protege la información veraz; los bulos o insultos no gozan de la misma protección.' },
        ],
      },
      juez: {
        q: '¿Cuál es tu fallo?',
        o: [
          { t: 'Desestimo la querella: prima la libertad de información veraz sobre asunto público (art. 20).', ok: true, por: 'Los cargos públicos soportan mayor crítica cuando la información es veraz y relevante.' },
          { t: 'Estimo: toda crítica a un cargo vulnera su honor.', ok: false, por: 'No toda crítica es intromisión; el cargo público está más expuesto al escrutinio.' },
          { t: 'Inadmito: los medios no son titulares de derechos fundamentales.', ok: false, por: 'La libertad de información ampara a medios y periodistas.' },
        ],
      },
    },
    {
      titulo: 'Ochenta horas detenido', arts: [17],
      hechos: 'Una persona lleva 80 horas detenida en comisaría sin ser puesta a disposición del juez.',
      rolAbogado: 'Defiendes a la persona detenida.',
      abogado: {
        q: '¿Qué actuación pides con urgencia?',
        o: [
          { t: 'Solicito el habeas corpus: la detención supera el máximo de 72 horas del art. 17.', ok: true, por: 'La detención preventiva no puede pasar de 72 horas sin ir al juez; el habeas corpus corrige detenciones ilegales.' },
          { t: 'Pido una indemnización, pero la detención sigue siendo legal mientras investiguen.', ok: false, por: 'Pasadas las 72 horas la detención es ilegal, no solo indemnizable.' },
          { t: 'No cabe hacer nada hasta que se celebre el juicio.', ok: false, por: 'El habeas corpus es un procedimiento urgente pensado justo para esto.' },
        ],
      },
      juez: {
        q: '¿Qué resuelves?',
        o: [
          { t: 'Declaro ilegal la detención por superar las 72 horas (art. 17) y ordeno pasar al juez o liberar.', ok: true, por: 'El límite de 72 horas es taxativo.' },
          { t: 'La detención es válida: 80 horas es razonable en casos complejos.', ok: false, por: 'No hay margen: el máximo constitucional son 72 horas.' },
          { t: 'Archivo: el habeas corpus no existe en nuestro ordenamiento.', ok: false, por: 'El art. 17.4 lo garantiza expresamente.' },
        ],
      },
    },
    {
      titulo: 'Registro sin orden', arts: [18],
      hechos: 'La policía entra en una vivienda sin orden judicial, sin permiso del morador y sin delito flagrante, y halla pruebas.',
      rolAbogado: 'Defiendes al morador.',
      abogado: {
        q: '¿Cuál es tu alegato?',
        o: [
          { t: 'El registro vulnera la inviolabilidad del domicilio (art. 18.2); la prueba obtenida es nula.', ok: true, por: 'Sin consentimiento, resolución judicial o flagrante delito, la entrada es ilícita y la prueba, nula.' },
          { t: 'La entrada es válida porque al final encontraron algo ilegal.', ok: false, por: 'El hallazgo no legaliza una entrada ilícita.' },
          { t: 'El domicilio solo se protege si es propiedad del morador.', ok: false, por: 'Protege cualquier morada, sea en propiedad o alquiler.' },
        ],
      },
      juez: {
        q: '¿Qué decides sobre la prueba?',
        o: [
          { t: 'Declaro nula la prueba: la entrada fue inconstitucional (art. 18.2).', ok: true, por: 'La prueba obtenida vulnerando un derecho fundamental no puede sostener la condena.' },
          { t: 'Válida: el fin de perseguir el delito justifica los medios.', ok: false, por: 'El fin no justifica vulnerar derechos fundamentales.' },
          { t: 'Válida si la policía actuó de buena fe.', ok: false, por: 'La buena fe no subsana la falta de orden judicial.' },
        ],
      },
    },
    {
      titulo: 'El registro de creencias', arts: [16],
      hechos: 'Una norma obliga a los ciudadanos a declarar su religión para figurar en un registro público.',
      rolAbogado: 'Recurres la norma en nombre de una asociación.',
      abogado: {
        q: '¿En qué fundas el recurso?',
        o: [
          { t: 'Nadie puede ser obligado a declarar sobre su ideología, religión o creencias (art. 16.2).', ok: true, por: 'El art. 16.2 prohíbe expresamente obligar a declarar las creencias.' },
          { t: 'Es válido siempre que el registro sea confidencial.', ok: false, por: 'La obligación de declarar creencias está prohibida, sea o no confidencial.' },
          { t: 'La libertad religiosa no protege a quien no tiene ninguna religión.', ok: false, por: 'Protege también la libertad ideológica y a quien no profesa ninguna religión.' },
        ],
      },
      juez: {
        q: '¿Cuál es el fallo?',
        o: [
          { t: 'Inconstitucional: vulnera el art. 16.2 (nadie obligado a declarar sus creencias).', ok: true, por: 'La obligación choca frontalmente con la libertad garantizada.' },
          { t: 'Constitucional por su utilidad estadística.', ok: false, por: 'Ningún interés estadístico justifica obligar a declarar creencias.' },
          { t: 'Estimación parcial: solo se anula para los funcionarios.', ok: false, por: 'La prohibición alcanza a todas las personas.' },
        ],
      },
    },
    {
      titulo: 'Colegio de pago obligatorio', arts: [27],
      hechos: 'Una familia sin recursos no logra escolarizar a su hijo porque el único centro cobra por la enseñanza básica.',
      rolAbogado: 'Defiendes a la familia.',
      abogado: {
        q: '¿Qué invocas?',
        o: [
          { t: 'La enseñanza básica es obligatoria y gratuita (art. 27.4); debe garantizarse una plaza gratuita.', ok: true, por: 'El art. 27.4 impone la gratuidad de la enseñanza básica.' },
          { t: 'La educación es un principio orientador, no un derecho exigible.', ok: false, por: 'El art. 27 es un derecho fundamental, con enseñanza básica gratuita.' },
          { t: 'Solo la universidad debería ser gratuita.', ok: false, por: 'Es la enseñanza básica la que la Constitución declara gratuita.' },
        ],
      },
      juez: {
        q: '¿Qué resuelves?',
        o: [
          { t: 'Amparo el derecho: los poderes públicos deben garantizar plaza gratuita en la enseñanza básica (art. 27.4).', ok: true, por: 'No hay derecho a un centro concreto, pero sí a la gratuidad de la enseñanza básica.' },
          { t: 'Desestimo: no existe ningún derecho relacionado con la educación.', ok: false, por: 'El art. 27 reconoce el derecho a la educación con enseñanza básica gratuita.' },
          { t: 'Desestimo: la educación no es asunto de los poderes públicos.', ok: false, por: 'Los poderes públicos garantizan el derecho a la educación.' },
        ],
      },
    },
    {
      titulo: 'Condena sin pruebas', arts: [24],
      hechos: 'A una persona se la condena basándose solo en sospechas, sin practicar prueba de cargo suficiente.',
      rolAbogado: 'Defiendes a la persona condenada.',
      abogado: {
        q: '¿Cuál es tu argumento clave?',
        o: [
          { t: 'Se ha vulnerado la presunción de inocencia (art. 24.2): no hay prueba de cargo suficiente.', ok: true, por: 'Sin prueba de cargo válida, la presunción de inocencia impide condenar.' },
          { t: 'Basta con que el juez esté convencido, aunque no haya pruebas.', ok: false, por: 'La convicción debe apoyarse en prueba de cargo; las meras sospechas no bastan.' },
          { t: 'La presunción de inocencia solo vale para delitos leves.', ok: false, por: 'Rige en todo el proceso penal, sea cual sea el delito.' },
        ],
      },
      juez: {
        q: '¿Qué decides?',
        o: [
          { t: 'Estimo el amparo: sin prueba de cargo suficiente se vulnera la presunción de inocencia (art. 24.2).', ok: true, por: 'La duda razonable debe favorecer al acusado.' },
          { t: 'Confirmo la condena: la sospecha del tribunal es suficiente.', ok: false, por: 'La sospecha no es prueba.' },
          { t: 'Devuelvo el caso para que declaren más testigos de la defensa.', ok: false, por: 'El problema es la falta de prueba de cargo, no de la defensa.' },
        ],
      },
    },
    {
      titulo: 'Castigar lo que ayer era legal', arts: [25, 9],
      hechos: 'Una ley nueva pretende sancionar conductas realizadas antes de su entrada en vigor, cuando aún eran lícitas.',
      rolAbogado: 'Defiendes a una persona sancionada de forma retroactiva.',
      abogado: {
        q: '¿Qué alegas?',
        o: [
          { t: 'Nadie puede ser condenado por acciones que al cometerse no eran delito ni infracción (art. 25.1); rige la irretroactividad (art. 9.3).', ok: true, por: 'Los arts. 25.1 y 9.3 prohíben aplicar retroactivamente normas sancionadoras desfavorables.' },
          { t: 'La ley puede castigar el pasado si el fin es de interés general.', ok: false, por: 'La irretroactividad de lo sancionador desfavorable no admite esa excepción.' },
          { t: 'La irretroactividad solo protege frente a leyes penales, no administrativas.', ok: false, por: 'Alcanza a toda disposición sancionadora desfavorable, también la administrativa.' },
        ],
      },
      juez: {
        q: '¿Cuál es el fallo?',
        o: [
          { t: 'Inconstitucional: vulnera la legalidad sancionadora y la irretroactividad (arts. 25.1 y 9.3).', ok: true, por: 'No se puede sancionar lo que era lícito cuando se hizo.' },
          { t: 'Constitucional si beneficia al interés general.', ok: false, por: 'El interés general no habilita sancionar retroactivamente.' },
          { t: 'Constitucional porque las leyes se presumen válidas.', ok: false, por: 'La presunción cede ante una vulneración clara de la Constitución.' },
        ],
      },
    },
    {
      titulo: 'Manifestación prohibida', arts: [21],
      hechos: 'La autoridad prohíbe una manifestación pacífica solo porque los convocantes no pidieron "autorización previa".',
      rolAbogado: 'Defiendes a los convocantes.',
      abogado: {
        q: '¿Qué alegas?',
        o: [
          { t: 'La manifestación pacífica no necesita autorización, solo comunicación previa; solo cabe prohibirla por peligro para personas o bienes (art. 21).', ok: true, por: 'El art. 21 exige comunicación previa, no autorización, y limita la prohibición a razones de orden con peligro real.' },
          { t: 'Toda manifestación necesita permiso previo de la autoridad.', ok: false, por: 'Se exige comunicación, no autorización.' },
          { t: 'El derecho de reunión no ampara las manifestaciones en la calle.', ok: false, por: 'Ampara reuniones y manifestaciones en lugares de tránsito público, con comunicación previa.' },
        ],
      },
      juez: {
        q: '¿Qué resuelves?',
        o: [
          { t: 'Anulo la prohibición: faltó comunicación, no autorización, y no consta peligro para personas o bienes (art. 21).', ok: true, por: 'Sin peligro acreditado no cabe prohibir una reunión pacífica.' },
          { t: 'Confirmo la prohibición: sin permiso previo no hay derecho.', ok: false, por: 'El régimen es de comunicación, no de autorización.' },
          { t: 'Confirmo: manifestarse nunca es un derecho fundamental.', ok: false, por: 'El art. 21 es un derecho fundamental.' },
        ],
      },
    },
    {
      titulo: 'Un reglamento que recorta derechos', arts: [53],
      hechos: 'Un simple reglamento del Gobierno limita el contenido esencial de un derecho fundamental, sin que exista una ley que lo regule.',
      rolAbogado: 'Recurres el reglamento.',
      abogado: {
        q: '¿En qué te apoyas?',
        o: [
          { t: 'Solo por ley (que respete su contenido esencial) puede regularse el ejercicio de los derechos fundamentales (art. 53.1).', ok: true, por: 'El art. 53.1 impone reserva de ley y respeto al contenido esencial; un reglamento no basta.' },
          { t: 'El Gobierno puede limitar derechos por reglamento si hay urgencia.', ok: false, por: 'La regulación del ejercicio de los derechos está reservada a la ley.' },
          { t: 'Los derechos fundamentales no tienen ninguna garantía especial.', ok: false, por: 'El art. 53 establece garantías reforzadas, incluido el amparo.' },
        ],
      },
      juez: {
        q: '¿Cuál es el fallo?',
        o: [
          { t: 'Inconstitucional: vulnera la reserva de ley y el contenido esencial del derecho (art. 53.1).', ok: true, por: 'Un reglamento no puede regular el ejercicio de un derecho fundamental.' },
          { t: 'Constitucional: cualquier norma puede regular derechos.', ok: false, por: 'Solo la ley puede, y respetando el contenido esencial.' },
          { t: 'Constitucional si el reglamento es posterior a la Constitución.', ok: false, por: 'La fecha no salva la falta de rango de ley.' },
        ],
      },
    },
  ];

  const TKEY = 'ce78_tribunal_v1';
  function loadBest() { try { return JSON.parse(localStorage.getItem(TKEY)) || { best: {}, total: CASOS.length }; } catch { return { best: {}, total: CASOS.length }; } }
  function saveBest(b) { try { localStorage.setItem(TKEY, JSON.stringify(b)); } catch { /* */ } }

  let T = { mode: 'abogado', order: [], i: 0, wins: 0, answered: false };

  function renderModeBar() {
    const bar = $('tribModeBar');
    const modes = [['abogado', '⚖️ Abogado/a', 'Elige el mejor alegato'], ['juez', '👨‍⚖️ Juez/a', 'Dicta el fallo correcto']];
    bar.innerHTML = modes.map(([k, n, d]) => `<button class="trib-mode ${T.mode === k ? 'sel' : ''}" data-tm="${k}"><b>${n}</b><small>${d}</small></button>`).join('');
    bar.querySelectorAll('.trib-mode').forEach((b) => b.addEventListener('click', () => {
      if (T.mode === b.dataset.tm) return;
      T.mode = b.dataset.tm; sfxSafe('click'); newRun(); renderModeBar(); renderCase();
    }));
  }
  function newRun() { T.order = shuffle(CASOS.map((_, k) => k)); T.i = 0; T.wins = 0; }

  function markMastered(arts) {
    try { if (typeof S !== 'undefined') { S.stats.mastered = S.stats.mastered || {}; arts.forEach((a) => { S.stats.mastered[a] = true; }); if (typeof save === 'function') save(); } } catch { /* */ }
  }

  function renderCase() {
    const c = CASOS[T.order[T.i]]; T.answered = false;
    $('tribRole').textContent = T.mode === 'abogado' ? '⚖️ Letrado/a' : '👨‍⚖️ Magistrado/a';
    $('tribProg').textContent = `Caso ${T.i + 1}/${CASOS.length}`;
    const block = T.mode === 'abogado' ? c.abogado : c.juez;
    const juez = (typeof PERSONAJES !== 'undefined') ? PERSONAJES.of('t6') : null;
    const juezAv = juez ? PERSONAJES.avatar('t6', 30) : '';
    const juezName = juez ? juez.name : 'el/la magistrado/a';
    const rol = T.mode === 'abogado'
      ? `<div class="tc-rol">${juezAv}<span>🧑‍💼 ${c.rolAbogado} · alegas ante ${juezName}</span></div>`
      : `<div class="tc-rol">${juezAv}<span>Eres ${juezName}: escuchas a las partes y dictas el fallo.</span></div>`;
    $('tribStage').innerHTML = `
      <div class="trib-case">
        <div class="tc-arts">${c.arts.map((a) => `<span class="tc-art">Art. ${a}</span>`).join('')}</div>
        <h2 class="tc-title">${c.titulo}</h2>
        <p class="tc-facts">${c.hechos}</p>
        ${rol}
        <div class="tc-q">${block.q}</div>
        <div class="tc-options" id="tcOptions"></div>
        <div class="tc-feedback" id="tcFeedback" hidden></div>
      </div>`;
    const box = $('tcOptions');
    shuffle(block.o).forEach((op) => {
      const b = document.createElement('button'); b.className = 'tc-opt'; b.textContent = op.t;
      b.addEventListener('click', () => answer(op, block, c, box));
      box.appendChild(b);
    });
  }
  function answer(op, block, c, box) {
    if (T.answered) return; T.answered = true;
    const correctOpt = block.o.find((x) => x.ok);
    [...box.children].forEach((ch) => {
      ch.disabled = true;
      if (ch.textContent === correctOpt.t) ch.classList.add('ok');
      else if (ch.textContent === op.t) ch.classList.add('bad');
    });
    const correct = op.ok;
    if (correct) { T.wins++; sfxSafe('correct'); markMastered(c.arts); if (typeof touchActivity === 'function') touchActivity(); } else sfxSafe('wrong');
    const fb = $('tcFeedback'); fb.hidden = false; fb.className = 'tc-feedback ' + (correct ? 'ok' : 'bad');
    fb.innerHTML = `
      <div class="fb-verdict">${correct ? '✅ ' + (T.mode === 'abogado' ? '¡Buen alegato!' : '¡Fallo acertado!') : '❌ No es lo más acertado'}</div>
      <div class="fb-why">${op.por || ''}</div>
      ${!correct ? `<div class="fb-correct"><b>Lo correcto:</b> ${correctOpt.t}<br><span>${correctOpt.por}</span></div>` : ''}
      <button id="tribNext" class="primary-btn">${T.i >= CASOS.length - 1 ? 'Ver resultado 🏛️' : 'Siguiente caso ➜'}</button>`;
    $('tribNext').addEventListener('click', () => { if (T.i >= CASOS.length - 1) summary(); else { T.i++; renderCase(); } });
    $('tribNext').focus();
  }
  function summary() {
    const pct = Math.round(T.wins / CASOS.length * 100);
    const b = loadBest(); b.total = CASOS.length; b.best = b.best || {};
    b.best[T.mode] = Math.max(b.best[T.mode] || 0, T.wins); saveBest(b);
    if (typeof save === 'function') save();
    const veredicto = pct >= 80 ? '🏆 Toga de honor' : pct >= 50 ? '⚖️ Letrado/a solvente' : '📚 Necesitas más sala';
    $('tribStage').innerHTML = `
      <div class="trib-case trib-summary">
        <div class="ts-emoji">🏛️</div>
        <h2>${veredicto}</h2>
        <p class="ts-score">Has resuelto <b>${T.wins}</b> de <b>${CASOS.length}</b> casos (${pct}%) como ${T.mode === 'abogado' ? 'abogado/a' : 'juez/a'}.</p>
        <div class="ts-actions">
          <button id="tribAgain" class="primary-btn">Otra vista ⚖️</button>
          <button id="tribToMenu" class="secondary-btn">Volver al menú</button>
        </div>
      </div>`;
    if (pct >= 80) { try { if (typeof confetti === 'function') confetti(); } catch { /* */ } }
    $('tribAgain').addEventListener('click', () => { newRun(); renderCase(); });
    $('tribToMenu').addEventListener('click', backToMenu);
  }
  function backToMenu() { $('tribunal').hidden = true; $('gameMenu').hidden = false; sfxSafe('click'); }

  function startTribunal() {
    $('gameMenu').hidden = true;
    newRun(); renderModeBar(); renderCase();
    $('tribunal').hidden = false;
  }
  window.startTribunal = startTribunal;

  const back = $('tribBack');
  if (back) back.addEventListener('click', backToMenu);
})();
