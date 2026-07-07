# Hoja de ruta

Plan de evolución del proyecto, desde el juego web actual hasta una posible
publicación en tiendas de aplicaciones. No son plazos cerrados, sino el orden
lógico de trabajo.

## ✅ Fase 1 — Juego web jugable (hecho)

- Mapa continental, 169 artículos, modo preparación y conquista estricta.
- Publicación como web gratuita en GitHub Pages.
- Guardado local de la partida.

## 🔜 Fase 2 — Pulido y métricas (validar la idea)

El objetivo de esta fase es **medir si el juego engancha** antes de invertir en
una app. Con la web publicada:

- [ ] Añadir analítica respetuosa con la privacidad (p. ej. un contador de
      partidas y de artículos conquistados, sin datos personales).
- [ ] Recoger opiniones reales (formulario o *issues*) y corregir contenido.
- [ ] Medir señales clave: ¿la gente vuelve al día siguiente?, ¿cuántos
      territorios conquista de media?, ¿dónde abandona?
- [ ] Ajustar dificultad, ritmo y textos según lo que digan los datos.

> **Criterio para pasar a la Fase 3:** que haya retención (gente que vuelve) y
> feedback positivo. Sin buenas métricas, mejor seguir mejorando la web.

## 📱 Fase 3 — Aplicación móvil (si las métricas acompañan)

El juego ya está hecho con tecnología web (HTML, CSS y JavaScript), lo que
permite convertirlo en app **sin reescribirlo**, envolviéndolo con una capa
nativa. Opciones habituales:

- **Capacitor** (recomendado para empezar): empaqueta la web como app de iOS y
  Android. Requiere una cuenta de desarrollador de Apple (99 $/año) y un Mac
  para compilar/subir a la App Store.
- **PWA (Progressive Web App)**: instalable desde el navegador sin pasar por la
  tienda. Es el paso intermedio más barato.

Trabajo previo necesario para la tienda:
- [ ] Icono de app, pantalla de carga y capturas para la ficha.
- [ ] Modo sin conexión completo (ya casi lo es: todo es estático).
- [ ] Política de privacidad y textos legales de la ficha.
- [ ] Decidir modelo: gratis, con anuncios, o de pago único.

## 💡 Ideas de contenido y funcionalidades (backlog)

- Modo contrarreloj y modo examen (simulacro tipo oposición).
- Ranking semanal / competición entre amigos.
- Más rutas de conquista y dificultad progresiva.
- Estatutos de Autonomía y leyes clave como "expansiones" del mapa.
- Localización a otras lenguas cooficiales.
