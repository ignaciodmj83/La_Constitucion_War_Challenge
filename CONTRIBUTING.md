# Cómo contribuir

¡Gracias por tu interés! Este proyecto es un juego educativo sobre la
Constitución Española. Se agradecen tanto las mejoras de código como las
correcciones de contenido (un artículo mal explicado, una errata, una
pregunta confusa…).

## Formas de ayudar sin programar

- **Reportar un error:** abre un *issue* con la plantilla "🐛 Informe de error".
- **Proponer una idea:** abre un *issue* con la plantilla "💡 Sugerencia".
- **Corregir un texto:** puedes editar el archivo desde la propia web de GitHub
  (botón del lápiz ✏️) y proponer el cambio; se crea un *pull request* solo.

## Si vas a tocar el código

Necesitas [Node.js](https://nodejs.org) (versión 18 o superior).

```bash
# 1. Clonar y entrar en la carpeta
git clone https://github.com/ignaciodmj83/La_Constitucion_War_Challenge.git
cd La_Constitucion_War_Challenge

# 2. Jugar en local
npm run serve        # abre http://localhost:8080

# 3. Antes de proponer un cambio, comprobar que todo está bien
npm test             # valida los 169 artículos, el mapa y las adyacencias
npm run build        # genera el archivo único en dist/
```

### Flujo de trabajo (buenas prácticas)

1. Crea una **rama** para tu cambio: `git checkout -b mejora-que-sea`.
2. Haz tus cambios y confírmalos con mensajes claros
   (`git commit -m "fix: corrige la pregunta del art. 47"`).
3. Sube la rama y abre un **Pull Request** contra `main`.
4. La **integración continua** (CI) ejecutará `npm test` automáticamente.
   No se fusiona nada que no pase las pruebas.

### Dónde está cada cosa

| Quieres cambiar… | Edita… |
|---|---|
| Un artículo, su explicación o su pregunta | `js/data.js` |
| Las reglas del juego, puntos, logros | `js/game.js` |
| Los colores y el aspecto | `css/game.css` |
| La forma o posición de los territorios | `tools/gen-map.js` (luego `npm run map`) |

## Estilo

- Español en textos de cara al usuario y en comentarios.
- Indentación de 2 espacios (ya configurado en `.editorconfig`).
- Mensajes de commit cortos y en presente: `fix:`, `feat:`, `docs:`, `style:`.
