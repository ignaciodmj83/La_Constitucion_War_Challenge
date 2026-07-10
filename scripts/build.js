#!/usr/bin/env node
/* =========================================================================
   build.js — genera el bundle "todo en uno" (dist/index.html)
   Inserta el CSS y todos los JS dentro del index.html, para poder abrir
   el juego con doble clic (file://) o subirlo a la App Store envuelto.
   No requiere dependencias: solo Node.
   Uso:  npm run build
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let html = read('index.html');
const css = read('css/game.css');
const js = ['js/map-data.js', 'js/hierarchy.js', 'js/data.js', 'js/voz.js', 'js/etiquetas.js', 'js/game.js', 'js/tribunal.js', 'js/trivial.js', 'js/juegos.js'].map(read).join('\n\n');

// Sustituir la hoja de estilos externa por un bloque <style> en línea
html = html.replace(/<link[^>]+game\.css[^>]*>/, `<style>\n${css}\n</style>`);
// Quitar las etiquetas <script src="js/..."> externas
html = html.replace(/<script src="js\/[^"]+"><\/script>\n?/g, '');
// Insertar todo el JS en línea justo antes de </body>
html = html.replace('</body>', `<script>\n/* Bundle generado por scripts/build.js */\n${js}\n</script>\n</body>`);

const outDir = path.join(ROOT, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'index.html');
fs.writeFileSync(out, html, 'utf8');

console.log(`✓ Bundle generado: dist/index.html (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
