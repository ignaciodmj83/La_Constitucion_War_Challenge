<div align="center">

# ⚔️ La Constitución: WarChallenge

**Aprende la Constitución Española de 1978 conquistando un mundo.**

Un juego de estrategia tipo *Risk* donde cada uno de los 169 artículos es un
territorio, cada título un continente y cada capítulo una isla.

[![CI](https://github.com/ignaciodmj83/La_Constitucion_War_Challenge/actions/workflows/ci.yml/badge.svg)](https://github.com/ignaciodmj83/La_Constitucion_War_Challenge/actions/workflows/ci.yml)
[![Jugar online](https://img.shields.io/badge/▶_jugar-online-brightgreen)](https://la-constitucion-war-challenge.vercel.app/)
![Sin dependencias](https://img.shields.io/badge/dependencias-ninguna-blue)
![169 artículos](https://img.shields.io/badge/artículos-169-e3a93f)

### 👉 [**Jugar ahora**](https://la-constitucion-war-challenge.vercel.app/)

<sub>Espejo alternativo: [GitHub Pages](https://ignaciodmj83.github.io/La_Constitucion_War_Challenge/)</sub>

![El mapa de Constitucia](docs/screenshots/mapa.png)

</div>

---

## ¿Qué es esto?

La Constitución Española es aquí el mundo de **Constitucia**. Cada uno de los 11
**títulos** es un continente; si el título tiene capítulos, es un **archipiélago**
cuyas islas son los capítulos. Cada uno de los **169 artículos** es un **territorio**.
El mapa es, a la vez, un mapa mental fiel de toda la Constitución.

Primero te **preparas** con el profesor del continente, que te explica sus artículos
uno a uno con una escena visual y un truco para recordarlos; luego **conquistas**
cada territorio respondiendo su pregunta. El mapa tiene **zoom y desplazamiento
propios** para explorarlo de cerca.

| Preparación con el profesor | Batalla de conquista |
|---|---|
| ![Preparación](docs/screenshots/preparacion.png) | ![Batalla](docs/screenshots/batalla.png) |

## Cómo se juega

1. **Explora** el mundo con **zoom** (rueda o botones ＋/−) y arrastrando para moverte.
2. **Prepárate** 🎓: el profesor del continente te explica sus artículos con una
   escena visual y un truco para recordarlos por asociación.
3. **Conquista** ⚔️: pulsa un territorio fronterizo y responde su pregunta. Si
   aciertas, el territorio es tuyo y puedes seguir expandiéndote.
4. **Completa continentes**, defiéndelos de **El Olvido** (que borra tu memoria
   con el tiempo real) y domina los 169 territorios.

Atajos: teclas `1`–`4` para responder, `Enter` para continuar, `←`/`→` en la
preparación.

## Características

- 🗺️ **Mapa mundial** con 8 continentes y 3 archipiélagos (capítulos = islas), rutas marítimas y **zoom/pan** propios.
- 📜 **169 territorios = 169 artículos**, cada uno con explicación, escena visual
  mnemotécnica, truco de asociación y pregunta tipo test.
- 🎓 **Modo preparación** con un profesor de personalidad propia por territorio.
- ⚔️ **Conquista** territorio a territorio: responde la pregunta del artículo y es tuyo.
- 🪖 **Guarniciones temáticas** por continente (Guardia Real, Los Togados, Mercaderes…).
- 🔥 Combos, 🎖️ rangos, 🏆 14 logros, 👑 modo prestigio, 📅 racha diaria y 🌫️ repaso espaciado.
- 💾 Guardado automático en el navegador · 🔊 sonido y 🎉 confeti · **sin conexión**.

## Jugar en tu ordenador

No necesita instalación de dependencias. Solo [Node.js](https://nodejs.org) (18+):

```bash
git clone https://github.com/ignaciodmj83/La_Constitucion_War_Challenge.git
cd La_Constitucion_War_Challenge
npm run serve          # abre http://localhost:8080
```

O, más sencillo aún: ejecuta `npm run build` y abre el archivo `dist/index.html`
con doble clic (funciona sin servidor y sin internet).

## Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm run serve` | Levanta el juego en `http://localhost:8080`. |
| `npm test` | Valida que los 169 artículos y el mapa son coherentes. |
| `npm run build` | Genera `dist/index.html` (todo el juego en un solo archivo). |
| `npm run map` | Regenera el mapa del continente (`js/map-data.js`). |

## Estructura del proyecto

```
La_Constitucion_War_Challenge/
├── index.html          # el juego
├── css/game.css        # estilos (mapa, tropas, escenas)
├── js/
│   ├── hierarchy.js    # estructura real: títulos → capítulos → artículos
│   ├── map-data.js     # mundo generado (169 formas, centros y adyacencias)
│   ├── data.js         # jerarquía + los 169 artículos (contenido)
│   └── game.js         # motor del juego (mapa, zoom, batallas, El Olvido)
├── tools/gen-map.js    # generador del mundo (Voronoi jerárquico de 2 niveles)
├── scripts/            # servidor local y generador del bundle
├── tests/validate.js   # pruebas de integridad del contenido
└── docs/ROADMAP.md     # hoja de ruta (incl. camino a la App Store)
```

## Tecnología

Web 100 % estática: **HTML, CSS y JavaScript** sin frameworks ni dependencias.
El mapa se genera con un **Voronoi jerárquico de dos niveles** (continentes y, dentro, un territorio por artículo); el sonido usa **WebAudio** y los efectos, **Canvas**. Al no usar
dependencias externas, el juego funciona sin conexión y es fácil de convertir
en app móvil más adelante (ver [hoja de ruta](docs/ROADMAP.md)).

## Contribuir

Se agradecen correcciones de contenido y mejoras. Lee
[CONTRIBUTING.md](CONTRIBUTING.md) — puedes ayudar incluso sin programar.

## Aviso

Proyecto educativo. El texto de la Constitución (BOE-A-1978-31229) es de dominio
público; las preguntas, explicaciones y el juego son obra original. **No
constituye asesoramiento jurídico.** Consulta la [licencia](LICENSE).
