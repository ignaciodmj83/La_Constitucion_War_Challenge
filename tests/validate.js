#!/usr/bin/env node
/* =========================================================================
   validate.js — pruebas de integridad del contenido y del mundo.
   Verifica la estructura real de la CE (títulos → capítulos → artículos),
   que los 169 artículos existen y que el mapa es coherente y conexo.
   No requiere dependencias: solo Node.
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Cargar map-data.js + data.js como un único script (para compartir ámbito)
const sandbox = {};
vm.createContext(sandbox);
const source = read('js/map-data.js') + '\n' + read('js/data.js') +
  '\n;globalThis.__g = { MAP, TITULOS, ARTICLES };';
vm.runInContext(source, sandbox, { filename: 'game-data.js' });
const { MAP, TITULOS, ARTICLES } = sandbox.__g;

const errors = [];
const fail = (m) => errors.push(m);

// Rango real de artículos por título (CE 1978)
const EXPECTED = {
  preliminar: [1, 9], t1: [10, 55], t2: [56, 65], t3: [66, 96], t4: [97, 107],
  t5: [108, 116], t6: [117, 127], t7: [128, 136], t8: [137, 158], t9: [159, 165], t10: [166, 169],
};
const rangeArts = (r) => { const [a, b] = r; const o = []; for (let n = a; n <= b; n++) o.push(n); return o; };

// 1) Títulos
if (!Array.isArray(TITULOS) || TITULOS.length !== 11) fail(`Se esperaban 11 títulos, hay ${TITULOS && TITULOS.length}`);
const seenArts = new Set();
for (const t of TITULOS) {
  if (!t.color || !t.prof || !t.faction) fail(`${t.id}: falta color/profesor/facción`);
  const arts = t.islands.flatMap((is) => rangeArts(is.arts));
  const [lo, hi] = EXPECTED[t.id] || [];
  if (arts[0] !== lo || arts[arts.length - 1] !== hi) fail(`${t.id}: rango ${arts[0]}-${arts[arts.length - 1]}, esperado ${lo}-${hi}`);
  for (const n of arts) { if (seenArts.has(n)) fail(`Artículo ${n} duplicado en la jerarquía`); seenArts.add(n); }
}
if (seenArts.size !== 169) fail(`La jerarquía cubre ${seenArts.size} artículos, esperados 169`);

// 2) Contenido de los 169 artículos
for (let n = 1; n <= 169; n++) {
  const a = ARTICLES[n];
  if (!a) { fail(`Falta el artículo ${n}`); continue; }
  if (!a.t || !a.e || !a.q || !a.mn) fail(`Art. ${n}: falta título/explicación/pregunta/mnemónico`);
  if (!Array.isArray(a.o) || a.o.length !== 4) fail(`Art. ${n}: debe tener 4 opciones`);
  if (a.c !== 0) fail(`Art. ${n}: la respuesta correcta debe ser el índice 0`);
  if (!Array.isArray(a.img) || a.img.length < 2) fail(`Art. ${n}: escena con menos de 2 emojis`);
}

// 3) Mapa: 169 territorios con path y centro
for (let n = 1; n <= 169; n++) {
  if (!MAP.art.path[n]) fail(`Mapa: falta el path del territorio ${n}`);
  if (!MAP.art.center[n]) fail(`Mapa: falta el centro del territorio ${n}`);
  if (!MAP.art.titulo[n] || !MAP.art.island[n]) fail(`Mapa: falta título/isla del territorio ${n}`);
}

// 4) Adyacencia simétrica
for (const [n, list] of Object.entries(MAP.adj)) {
  for (const m of list) {
    if (!MAP.adj[m]) fail(`Adyacencia hacia territorio inexistente: ${n}→${m}`);
    else if (!MAP.adj[m].includes(Number(n))) fail(`Adyacencia no simétrica: ${n}→${m}`);
  }
}

// 5) Mundo conexo desde el artículo 1
const seen = new Set([1]); const st = [1];
while (st.length) { const c = st.pop(); for (const m of (MAP.adj[c] || [])) if (!seen.has(m)) { seen.add(m); st.push(m); } }
if (seen.size !== 169) fail(`Mundo no conexo desde art. 1: alcanzables ${seen.size}/169`);

// Resultado
if (errors.length) {
  console.error('✗ Validación FALLIDA:\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
const conts = TITULOS.length, archi = TITULOS.filter((t) => t.islands.length > 1).length;
console.log(`✓ Validación correcta — ${conts} títulos (${archi} archipiélagos), 169 artículos/territorios, mapa conexo y adyacencias simétricas.`);
