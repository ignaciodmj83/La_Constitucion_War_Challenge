#!/usr/bin/env node
/* =========================================================================
   validate.js — pruebas de integridad de los datos del juego.
   Verifica que el contenido de la Constitución está completo y coherente.
   Se ejecuta en cada cambio (local con `npm test` y en CI).
   No requiere dependencias: solo Node.
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Cargar map-data.js y data.js como un único script (para que las variables
// `const` compartan ámbito) y exponerlas en el contexto para leerlas aquí.
const sandbox = {};
vm.createContext(sandbox);
const source = read('js/map-data.js') + '\n' + read('js/data.js') +
  '\n;globalThis.__game = { TERRITORIES, ARTICLES, MAP };';
vm.runInContext(source, sandbox, { filename: 'game-data.js' });
const { TERRITORIES, ARTICLES, MAP } = sandbox.__game;

const errors = [];
const fail = (msg) => errors.push(msg);

// Rango de artículos esperado por territorio (según la CE de 1978)
const EXPECTED = {
  preliminar: [1, 9], dignidad: [10, 14], derechos: [15, 29], deberes: [30, 38],
  rectores: [39, 52], garantias: [53, 55], corona: [56, 65], cortes: [66, 96],
  gobierno: [97, 107], relaciones: [108, 116], judicial: [117, 127],
  economia: [128, 136], territorial: [137, 158], tc: [159, 165], reforma: [166, 169],
};

// 1) Territorios
if (!Array.isArray(TERRITORIES) || TERRITORIES.length !== 15) fail(`Se esperaban 15 territorios, hay ${TERRITORIES && TERRITORIES.length}`);
for (const t of TERRITORIES) {
  if (!t.faction || !t.faction.unit) fail(`${t.id}: falta facción/tropa`);
  if (!t.prof || !t.prof.name) fail(`${t.id}: falta profesor`);
}

// 2) Artículos: numeración, rangos y campos obligatorios
let total = 0;
for (const t of TERRITORIES) {
  const arts = ARTICLES[t.id];
  if (!arts) { fail(`${t.id}: sin artículos`); continue; }
  total += arts.length;
  const [lo, hi] = EXPECTED[t.id];
  if (arts[0].n !== lo || arts[arts.length - 1].n !== hi) fail(`${t.id}: rango ${arts[0].n}-${arts[arts.length - 1].n}, esperado ${lo}-${hi}`);
  if (arts.length !== hi - lo + 1) fail(`${t.id}: ${arts.length} artículos, esperados ${hi - lo + 1}`);
  arts.forEach((a, i) => {
    if (a.n !== lo + i) fail(`${t.id}: artículo en posición ${i} es ${a.n}, esperado ${lo + i}`);
    if (!a.t || !a.e || !a.q || !a.mn) fail(`Art. ${a.n}: falta título/explicación/pregunta/mnemónico`);
    if (!Array.isArray(a.o) || a.o.length !== 4) fail(`Art. ${a.n}: debe tener 4 opciones`);
    if (a.c !== 0) fail(`Art. ${a.n}: la respuesta correcta debe ser el índice 0`);
    if (!Array.isArray(a.img) || a.img.length < 2) fail(`Art. ${a.n}: escena visual con menos de 2 emojis`);
  });
}
if (total !== 169) fail(`Se esperaban 169 artículos en total, hay ${total}`);

// 3) Mapa: adyacencias simétricas y grafo conexo desde el territorio inicial
if (MAP && MAP.adj) {
  for (const [id, neighbors] of Object.entries(MAP.adj)) {
    for (const n of neighbors) {
      if (!MAP.adj[n]) fail(`Adyacencia hacia territorio inexistente: ${id} → ${n}`);
      else if (!MAP.adj[n].includes(id)) fail(`Adyacencia no simétrica: ${id} → ${n} pero no al revés`);
    }
  }
  const start = TERRITORIES.find((t) => t.start);
  if (start) {
    const seen = new Set([start.id]);
    const stack = [start.id];
    while (stack.length) {
      const cur = stack.pop();
      for (const n of MAP.adj[cur] || []) if (!seen.has(n)) { seen.add(n); stack.push(n); }
    }
    if (seen.size !== TERRITORIES.length) fail(`Mapa no conexo desde ${start.id}: alcanzables ${seen.size}/${TERRITORIES.length}`);
  }
} else {
  fail('Falta MAP.adj (adyacencias del mapa)');
}

// Resultado
if (errors.length) {
  console.error('✗ Validación FALLIDA:\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`✓ Validación correcta — ${TERRITORIES.length} territorios, ${total} artículos, mapa conexo, adyacencias simétricas.`);
