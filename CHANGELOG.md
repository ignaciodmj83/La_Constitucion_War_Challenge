# Registro de cambios

Todas las versiones relevantes del proyecto se anotan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/)
y el proyecto usa [versionado semántico](https://semver.org/lang/es/) (MAYOR.MENOR.PARCHE).

## [2.0.0] — 2026-07-07

### Cambiado (rediseño del mapa)
- **Nuevo mundo "Constitucia" con estructura real de la Constitución**: 11 títulos
  como continentes y, cuando el título tiene capítulos, **archipiélagos** cuyas
  islas son los capítulos.
- **169 territorios** (uno por artículo) en lugar de 15. Cada continente tiene un
  color y una temática únicos (paleta validada para daltonismo).
- **Zoom y desplazamiento propios del mapa** (rueda/botones + arrastrar), sin
  afectar a la página.
- Leyenda de continentes con progreso por título; preparación por capítulo.

## [1.0.0] — 2026-07-07

### Añadido
- Primera versión jugable de **La Constitución: WarChallenge**.
- Mapa continental "Constitucia" con 15 territorios (los títulos de la CE de
  1978) y 2 islas, con superficie proporcional al número de artículos.
- Los **169 artículos** de la Constitución, cada uno con explicación, escena
  visual mnemotécnica, truco de asociación y pregunta tipo test.
- **Modo preparación** con un profesor de personalidad propia por territorio.
- **Conquista estricta**: una pregunta por artículo, sin fallar ninguna.
- Tropas temáticas visibles por territorio, combos, rangos, 14 logros,
  racha diaria, mecánica de "El Olvido" (repaso espaciado) y modo prestigio.
- Guardado automático de la partida en el navegador (localStorage).
- Sonido (WebAudio) y confeti (Canvas), sin dependencias externas.
- Despliegue continuo en [Vercel](https://la-constitucion-war-challenge.vercel.app/)
  y en [GitHub Pages](https://ignaciodmj83.github.io/La_Constitucion_War_Challenge/)
  (ambos se actualizan solos en cada cambio a `main`).

[2.0.0]: https://github.com/ignaciodmj83/La_Constitucion_War_Challenge/releases/tag/v2.0.0
[1.0.0]: https://github.com/ignaciodmj83/La_Constitucion_War_Challenge/releases/tag/v1.0.0
