# Registro de cambios

Todas las versiones relevantes del proyecto se anotan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/)
y el proyecto usa [versionado semántico](https://semver.org/lang/es/) (MAYOR.MENOR.PARCHE).

## [2.5.0] — 2026-07-09

### Añadido
- **Menú de inicio con varios juegos**: al abrir la app se elige entre 4 modos
  (por ahora **Conquista** —el mapa tipo Risk— y **Memorión**; los otros dos
  quedan como "Próximamente").
- **Memorión** (juego 2): galería con los 169 números de artículo, cada carta
  con el color de su reino. Al pulsar un número eliges de una lista (títulos de
  ≤3 palabras) de qué trata; al acertar, la carta queda descubierta con su
  símbolo. Progreso propio guardado.
- **Estadísticas gráficas** centradas en el opositor: barra de Preparación,
  **gráfico de estudio diario** (minutos/día, últimos 14 días, con la media) y
  artículos dominados / días seguidos.
- El **escudo del artículo** muestra ahora el número encima del símbolo.

### Cambiado / Arreglado
- **Índice**: se corrige el desplegable (un problema de flexbox lo recortaba);
  ahora abre la lista completa de artículos con scroll.
- Se **eliminan los trucos mnemotécnicos** (preparación, batalla y voz).
- El tiempo de estudio se cuenta en cualquier modo (contador global).

## [2.4.1] — 2026-07-09

### Arreglado
- **Índice de la Constitución**: el desplegable se quedaba bloqueado (scroll
  anidado + `<details>`). Ahora es un acordeón propio con un único contenedor
  con scroll: cada título abre y cierra bien, en móvil y escritorio.
- **Música**: no arrancaba al cargar (había que apagar/encender el interruptor).
  Ahora el audio se desbloquea al primer gesto real (pulsación/tecla/toque) en
  fase de captura, y la marcha suena desde el principio si está activada.

### Añadido
- **Contornos de capítulo**: cada capítulo del cuerpo de un reino se enmarca
  con una frontera visible (línea discontinua), para distinguir los capítulos
  dentro del reino.

## [2.4.0] — 2026-07-08

### Cambiado (mapa, música, voz y estadísticas)
- **Se eliminan los ríos**: los títulos con capítulos (I, III, VIII) muestran
  ahora sus capítulos pequeños como **islas del color del reino** frente a su
  costa, y los grandes forman el cuerpo principal. Así se ve el reino dividido
  en varias zonas sin líneas de río.
- **Essos** confirmado como continente ancho y horizontal; fronteras sinuosas.
- **Música** menos monótona (progresión de 8 compases con variación) y un
  **tema de guerra** que suena durante las conquistas y defensas.
- **Voz "para todos los públicos"**: en los artículos estrella (los más
  importantes para las oposiciones) la voz ya no lee el texto, sino que explica
  con lenguaje sencillo su importancia, qué pasaría si no existiera y un
  ejemplo. El resto usan la explicación normal.
- **Estadísticas orientadas a oposiciones**: nota de "Preparación" (dominio de
  artículos + precisión), artículos dominados y **mejor tiempo por dificultad**.
- **Índice de la Constitución** arreglado en móvil.

## [2.3.0] — 2026-07-08

### Añadido
- **Música de fondo** tipo marcha militar épica (estilo napoleónico), generada
  por procedimiento con WebAudio (bajo en marcha, redoble, pad de metales y
  melodía en re menor sobre progresión heroica), sin ficheros ni dependencias.
- **Voz del artículo**: botón 🗣️ que lee en voz alta el artículo (título,
  significado y truco) con la Web Speech API del navegador.
- **Niveles de dificultad** seleccionables (Fácil / Normal / Difícil) que
  ajustan el tiempo de respuesta por pregunta, el ritmo de El Olvido y —en
  Difícil— la **pérdida de 1 territorio por cada hora jugada**.
- **Tiempo de juego** acumulado en estadísticas y en la pantalla de victoria
  (cuánto se tarda en conquistarlo todo).
- Nueva pantalla de **Ajustes** (⚙️) con dificultad, música, efectos y voz.

### Cambiado (rediseño del mapa y de los artículos)
- **Essos** pasa a ser un continente **ancho y horizontal** a la derecha (antes
  vertical), fiel a la disposición del mapa de Juego de Tronos; Poniente sigue
  alto y estrecho a la izquierda.
- **Fronteras sinuosas** de territorios y reinos mediante un campo de ruido
  (domain warp): ya no son rectas.
- Las **montañas se sustituyen por ríos**, y los ríos se **recortan al
  interior**: nunca se meten en el mar.
- Cada reino muestra un **emblema grande y distintivo**; la leyenda y el nuevo
  **índice desplegable** (títulos → capítulos → artículos) llevan ese símbolo.
- Cada artículo se representa con **un único escudo heráldico** (color del reino
  + símbolo de su palabra clave), en vez de la suma de tres emojis.

## [2.2.0] — 2026-07-07

### Cambiado (dos continentes y fronteras orgánicas)
- El mundo pasa de **un único continente** a **dos continentes** separados por
  el mar: "home" (Preliminar + Título I + Título II, más pequeño, tipo
  Poniente — aquí se empieza siempre) y "far" (Títulos III a VIII, más
  grande, con silueta propia tipo Essos). Para llegar al segundo hay que
  cruzar el mar por una **ruta marítima obligatoria** (además de las 2 rutas
  a las islas IX y X, reubicadas junto a la costa de "far").
- **Fronteras de capítulo realmente orgánicas**: los ríos y cordilleras entre
  comarcas de un mismo título ya no se generan cortando una lista ordenada de
  celdas (lo que daba líneas rectas o diagonales "sin gracia"); ahora se
  genera primero una **curva serpenteante** (ríos: meandro suave con pocos
  armónicos; cordilleras: quiebros más bruscos con más armónicos y menos
  suavizado) con la amplitud acotada para no cruzarse con las curvas vecinas,
  y esa curva se usa a la vez para **clasificar las celdas** del mapa y para
  **dibujar la frontera decorativa** — orgánica por construcción.
- **Colores de reino visibles desde el principio**: los territorios que aún
  no se han alcanzado dejaban de mostrar su color y se pintaban de un gris
  plano uniforme; ahora se pintan con el color de su título muy oscurecido,
  de forma que la silueta de cada título se intuye en el mapa desde el
  primer vistazo, aunque no se haya conquistado ni un solo territorio.

## [2.1.0] — 2026-07-07

### Cambiado (mapa inspirado en Poniente)
- El mundo pasa de "títulos con archipiélagos de islas" a un **único continente**
  alargado de norte a sur, con silueta orgánica (norte frío y estrecho → cuello
  → tierras anchas → península sur), inspirado en los mapas de fantasía tipo
  Poniente.
- **Se empieza siempre en el norte**, en una región propia ("El Confín Helado",
  nombre original para evitar cualquier choque de marca).
- Los títulos con capítulos (I, III, VIII) ya **no son archipiélagos de islas
  en el mar**: ahora son una sola región dividida internamente por un **río o
  una cordillera** (renderizados como frontera decorativa animada), separadas
  "un pelín" pero siempre contiguas por tierra.
- Solo el Tribunal Constitucional y la Reforma Constitucional siguen siendo
  **islas** de verdad, con un estrecho de mar garantizado frente a la costa y
  su propia ruta marítima.
- Refactor interno: `js/hierarchy.js` deja de duplicarse dentro de `js/data.js`
  (bug que causaba que los cambios de la jerarquía no se aplicaran); ahora se
  carga como script independiente y es la única fuente de verdad.

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
