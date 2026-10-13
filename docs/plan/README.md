# Plan de desarrollo de iCount

Desarrollo completo por fases, en **dos pistas en paralelo**: **A (Opus)** para arquitectura, backend y lo difícil, y **B (Sonnet)** para design system y pantallas. Reglas para no pisarse: [PROTOCOLO.md](PROTOCOLO.md).

## Estado

> Se actualiza **solo** en la tarea `X.0` de cada fase (marca la anterior como hecha y la nueva en curso) y en `X.9` (cierre).

| Fase | Objetivo | Release | Estado |
|---|---|---|---|
| 0 · Fundaciones | Entorno, repo, arquitectura, ADRs, diseño elegido | — | ✅ Hecha |
| [1 · Cimientos](fase-1-cimientos.md) | Monorepo, backend base, contratos, red, design system, navegación | 0.1.0 | ✅ Hecha |
| [2 · Identidad y hogar](fase-2-identidad-y-hogar.md) | Onboarding, login sin contraseña, crear o unirse a un hogar, reparto | 0.2.0 | 🚧 En curso |
| [G · Preparación global](fase-g-preparacion-global.md) | Las `X.0` de las fases 3–7 de una vez | — | 🚧 En curso (3.0 ✅ · 4.0 ✅) |
| [3 · Movimientos](fase-3-movimientos.md) | Añadir, Inicio, Historial, persistencia y actualizaciones optimistas | 0.3.0 | 🚧 En curso |
| [4 · Planificación](fase-4-planificacion.md) | Motor financiero, presupuestos, deudas, pagos recurrentes | 0.4.0 | 🚧 En curso |
| [5 · Hogar compartido](fase-5-hogar-compartido.md) | Balances, saldar cuentas, actividad y aprobaciones, push, E2E | 0.5.0 | ⏳ Pendiente |
| [6 · Lanzamiento](fase-6-lanzamiento.md) | Despliegue, seguridad, pulido, rendimiento, tiendas | 1.0.0 | ⏳ Pendiente |
| [7 · Asistente IA](fase-7-asistente-ia.md) | Hallazgos de ahorro, planes, chat con Claude | 1.1.0 | ⏳ Pendiente |
| [Backlog](backlog.md) | Ideas por planificar (empresas, OCR, bancos…) | — | 💡 |

Leyenda de estado: ⏳ pendiente · 🚧 en curso · ✅ hecha.

## Cómo se trabaja

1. **Preparación de la fase (sesión Opus):** `/tarea 1.0`. Tras fusionarla, en las dos carpetas: `git pull && npm install`.
2. **En paralelo:**
   - Sesión **Opus** (carpeta `iCount`): `/tarea A-1.1`, luego `A-1.2`…
   - Sesión **Sonnet** (carpeta `iCount-b`): `/tarea B-1.1`, luego `B-1.2`…
   - Para saber qué toca: `/estado`.
   - **Preparación global:** las `X.0` de las fases 3–7 se hacen de una vez en [G.0](fase-g-preparacion-global.md) (un PR por fase). Con G.0 hecha, cada pista avanza por su roadmap sin esperar a la otra; ver [PROTOCOLO.md](PROTOCOLO.md#modo-de-preparación-global).
3. **Cierre (sesión Opus):** `/tarea 1.9`, que integra, prueba, marca la fase y publica la release.

Cada tarea tiene en su fichero de fase: rama, dependencias, **ficheros exclusivos**, criterios de hecho y un **prompt específico**. Puedes pegar ese prompt tal cual o usar `/tarea <ID>`, que hace lo mismo.

## Por qué este reparto (Opus / Sonnet)
- **Opus** para lo que tiene decisiones de diseño difíciles o riesgo alto: seguridad, sincronización, cálculo financiero, integración, IA y despliegue.
- **Sonnet** para trabajo bien acotado por los diseños y los puertos ya definidos: componentes, pantallas, ViewModels y tests.
- Las tareas `X.0` concentran las decisiones y dependencias compartidas, para que el paralelo sea mecánico y sin conflictos.

## Mapa de dependencias entre pistas

```
Fase 1: 1.0 ─┬─ A-1.1 → A-1.2 → A-1.3 ──────────────┐
             └─ B-1.1 → B-1.2 ───────────────────────┴─ 1.9
Fase 2: 2.0 ─┬─ A-2.1 → A-2.2 → A-2.3 ──────────────┐
             └─ B-2.1 → B-2.2 → B-2.3 ───────────────┴─ 2.9
Fase 3: 3.0 ─┬─ A-3.1 → A-3.2 ──────────────────────┐
             └─ B-3.1 → B-3.2 → B-3.3 ───────────────┴─ 3.9
Fase 4: 4.0 ─┬─ A-4.1 → A-4.2 → A-4.3 ──────────────┐
             └─ B-4.1 → B-4.2 (necesita A-4.1) → B-4.3 ┴─ 4.9
Fase 5: 5.0 ─┬─ A-5.1 → A-5.2 ──────────────────────┐
             └─ B-5.1 → B-5.2 → B-5.3 ───────────────┴─ 5.9
Fase 6: 6.0 ─┬─ A-6.1 → A-6.2 ──────────────────────┐
             └─ B-6.1 → B-6.2 ───────────────────────┴─ 6.9
Fase 7: 7.0 ─┬─ A-7.1 ──────────────────────────────┐
             └─ B-7.1 ───────────────────────────────┴─ 7.9
```

Mientras la pista A no haya terminado su parte, la pista B trabaja contra repositorios **en memoria** que implementan los mismos puertos. En `X.9` se cambian a la API real.
