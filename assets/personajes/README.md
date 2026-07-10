# Retratos de los personajes (El Consejo Constituyente)

Cada título de la Constitución tiene un guardián. El juego busca su retrato en
esta carpeta y, si no lo encuentra, dibuja un marco temático con el emblema del
título como respaldo (así el juego funciona siempre).

## Cómo añadir el arte

Coloca cada retrato como PNG (idealmente **fondo transparente**, orientación
vertical ~3:4) con este nombre exacto:

| Archivo            | Personaje / Título                         |
|--------------------|--------------------------------------------|
| `preliminar.png`   | El Sabio Fundador — Título Preliminar      |
| `t1.png`           | El Custodio de los Derechos — Título I      |
| `t2.png`           | El Rey — Título II                          |
| `t3.png`           | La Voz de las Cortes — Título III           |
| `t4.png`           | El Ministro del Reino — Título IV           |
| `t5.png`           | El Enlace Parlamentario — Título V           |
| `t6.png`           | El Juez del Búho — Título VI                |
| `t7.png`           | El Tesorero del Reino — Título VII          |
| `t8.png`           | La Cartógrafa de España — Título VIII       |
| `t9.png`           | Los Guardianes del Tribunal — Título IX     |
| `t10.png`          | La Arquitecta de la Reforma — Título X      |
| `unidad.png`       | La Unidad de España (figura final/heroína) |

## Opción: recortar desde los collages

Si te resulta más fácil, deja los dos collages originales (los que pasaste en el
chat) en `origen/` como `collage1.png` (Preliminar–V) y `collage2.png`
(VI–X + Unidad). Con los archivos ya en el repositorio, en una sesión los recorto
yo en los 12 retratos y los dejo con el nombre correcto.

`build.js` copia toda esta carpeta a `dist/assets/` en la compilación.
