/* =========================================================================
   Estructura real de la Constitución Española de 1978.
   El mundo "Constitucia" tiene DOS CONTINENTES separados por un mar
   ("home", pequeño, donde se empieza — y "far", grande, al que se cruza
   por una ruta marítima obligatoria) más 2 islas costeras (IX y X).
   Cada título es una REGIÓN de su continente. Si un título tiene
   capítulos, esa región se divide internamente en COMARCAS separadas por
   un accidente geográfico (río o cordillera) — contiguas, no por mar.
   Cada artículo es un TERRITORIO (169 en total). Se empieza siempre en
   El Confín Helado, en el extremo norte del continente "home".
   `arts` es [desde, hasta] (rango inclusivo de números de artículo).
   `continent`: 'home' (donde se empieza) o 'far' (al otro lado del mar).
   ========================================================================= */

const TITULOS = [
  {
    id: 'preliminar', roman: '', name: 'Título Preliminar',
    theme: 'El Confín Helado', color: '#e0a52e', start: true, continent: 'home',
    emblem: '📜',
    faction: { name: 'Los Fundadores', unit: '🏛️' },
    prof: { emoji: '👵', name: 'Doña Carta Magna', motto: 'Yo estuve allí en el 78. Aquí, en el norte, empieza todo, criatura.' },
    islands: [{ id: 'preliminar', name: 'El Confín Helado', arts: [1, 9] }],
  },
  {
    id: 't1', roman: 'I', name: 'Derechos y Deberes Fundamentales',
    theme: 'Las Tierras de la Libertad', color: '#2f9e5f', continent: 'home',
    emblem: '🕊️',
    faction: { name: 'Guardianes de la Libertad', unit: '🕊️' },
    prof: { emoji: '🦅', name: 'Libertas, la Centinela', motto: 'Cuarenta y seis comarcas de derechos custodio. Son el corazón de todo.' },
    chapterDivider: 'river', dividerName: 'El Río de las Libertades',
    islands: [
      { id: 't1_portico', name: 'Pórtico · La Dignidad', arts: [10, 10] },
      { id: 't1_c1', name: 'Cap. I · Españoles y extranjeros', arts: [11, 13] },
      { id: 't1_c2', name: 'Cap. II · Derechos y libertades', arts: [14, 38] },
      { id: 't1_c3', name: 'Cap. III · Principios rectores', arts: [39, 52] },
      { id: 't1_c4', name: 'Cap. IV · Garantías', arts: [53, 54] },
      { id: 't1_c5', name: 'Cap. V · Suspensión', arts: [55, 55] },
    ],
  },
  {
    id: 't2', roman: 'II', name: 'La Corona',
    theme: 'El Reino de la Corona', color: '#7a4fbf', continent: 'home',
    emblem: '👑',
    faction: { name: 'La Guardia Real', unit: '💂' },
    prof: { emoji: '🎩', name: 'El Cronista Real', motto: 'Palacio guarda mil secretos y yo los apunto todos.' },
    islands: [{ id: 't2', name: 'El Reino', arts: [56, 65] }],
  },
  {
    id: 't3', roman: 'III', name: 'Las Cortes Generales',
    theme: 'Las Tierras de las Cámaras', color: '#4d92e0', continent: 'far',
    emblem: '🏛️',
    faction: { name: 'Los Dos Hemiciclos', unit: '🪶' },
    prof: { emoji: '🧑‍🏫', name: 'El Letrado Mayor', motto: 'Tres comarcas legislativas, separadas por el Río de las Cámaras. Sin mí, aquí te pierdes.' },
    chapterDivider: 'river', dividerName: 'El Río de las Cámaras',
    islands: [
      { id: 't3_c1', name: 'Cap. I · De las Cámaras', arts: [66, 80] },
      { id: 't3_c2', name: 'Cap. II · Elaboración de las leyes', arts: [81, 92] },
      { id: 't3_c3', name: 'Cap. III · Tratados internacionales', arts: [93, 96] },
    ],
  },
  {
    id: 't4', roman: 'IV', name: 'Gobierno y Administración',
    theme: 'Las Tierras del Ejecutivo', color: '#e0742f', continent: 'far',
    emblem: '⚙️',
    faction: { name: 'El Consejo de Ministros', unit: '🧑‍💼' },
    prof: { emoji: '👩‍💼', name: 'La Subsecretaria', motto: 'Aquí se gobierna de verdad. Firma aquí y te lo explico.' },
    islands: [{ id: 't4', name: 'El Ejecutivo', arts: [97, 107] }],
  },
  {
    id: 't5', roman: 'V', name: 'Relaciones Gobierno–Cortes',
    theme: 'El Istmo de los Controles', color: '#23a58f', continent: 'far',
    emblem: '🤝',
    faction: { name: 'Duelistas de la Censura', unit: '🤺' },
    prof: { emoji: '🧔', name: 'El Maestro de Duelos', motto: 'Censura, confianza, disolución: esgrima parlamentaria pura.' },
    islands: [{ id: 't5', name: 'El Istmo', arts: [108, 116] }],
  },
  {
    id: 't6', roman: 'VI', name: 'El Poder Judicial',
    theme: 'Las Tierras de la Toga', color: '#d24b3e', continent: 'far',
    emblem: '⚖️',
    faction: { name: 'Los Togados', unit: '👩‍⚖️' },
    prof: { emoji: '👵🏻', name: 'La Magistrada Emérita', motto: 'Cuarenta años dictando sentencias. Silencio y toma apuntes.' },
    islands: [{ id: 't6', name: 'La Toga', arts: [117, 127] }],
  },
  {
    id: 't7', roman: 'VII', name: 'Economía y Hacienda',
    theme: 'Las Minas del Tesoro', color: '#9c7a1e', continent: 'far',
    emblem: '🪙',
    faction: { name: 'Mercaderes del Tesoro', unit: '🪙' },
    prof: { emoji: '🤑', name: 'El Tesorero de la Villa', motto: '¿Quién paga todo esto? Ven, que te enseño el oro del reino.' },
    islands: [{ id: 't7', name: 'El Tesoro', arts: [128, 136] }],
  },
  {
    id: 't8', roman: 'VIII', name: 'Organización Territorial',
    theme: 'Las Tierras de las Autonomías', color: '#86ac3c', continent: 'far',
    emblem: '🗺️',
    faction: { name: 'La Confederación de Municipios', unit: '🏘️' },
    prof: { emoji: '🧭', name: 'La Cartógrafa', motto: 'Municipios, provincias, autonomías: tres comarcas separadas por el Río. Yo dibujé este mapa.' },
    chapterDivider: 'river', dividerName: 'El Río de las Autonomías',
    islands: [
      { id: 't8_c1', name: 'Cap. I · Principios generales', arts: [137, 139] },
      { id: 't8_c2', name: 'Cap. II · Administración Local', arts: [140, 142] },
      { id: 't8_c3', name: 'Cap. III · Comunidades Autónomas', arts: [143, 158] },
    ],
  },
  {
    id: 't9', roman: 'IX', name: 'Tribunal Constitucional',
    theme: 'La Isla del Guardián', color: '#c43a6e', island: true, continent: 'far',
    emblem: '🛡️',
    faction: { name: 'Los Doce Sabios', unit: '🧙' },
    prof: { emoji: '🧙‍♂️', name: 'El Duodécimo Sabio', motto: 'En esta isla vigilamos la Constitución entera. Pocos llegan hasta aquí.' },
    islands: [{ id: 't9', name: 'El Guardián', arts: [159, 165] }],
  },
  {
    id: 't10', roman: 'X', name: 'Reforma Constitucional',
    theme: 'La Isla de la Llave', color: '#8a93a8', island: true, continent: 'far',
    emblem: '🔑',
    faction: { name: 'Ingenieros de la Carta', unit: '🔧' },
    prof: { emoji: '👷‍♀️', name: 'La Ingeniera Constituyente', motto: '¿Cambiar la Constitución? Se puede… si giras las llaves correctas.' },
    islands: [{ id: 't10', name: 'La Llave', arts: [166, 169] }],
  },
];

if (typeof module !== 'undefined') module.exports = { TITULOS };
