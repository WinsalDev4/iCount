# iCount — guía para Claude

App de finanzas personales y economías compartidas (parejas, familias, pisos). Monorepo con npm workspaces:
`mobile/` (Expo SDK 57 + React Native + TS), `backend/` (NestJS + PostgreSQL + Drizzle), `packages/contracts` (zod), `docs/`.
Antes de tocar APIs de Expo, lee `mobile/AGENTS.md`: consulta la doc versionada, no la memoria.

## Decisiones vigentes (detalle en `docs/adr/`)
| Tema | Decisión | ADR |
|---|---|---|
| Framework | Expo SDK 57, development builds, EAS Build (iOS en la nube desde Windows) | 0002, 0010 |
| Arquitectura | Clean Architecture + **MVVM** por feature; DI manual con módulos por feature | 0003 |
| Backend | **NestJS + PostgreSQL**, Clean Architecture por módulo | 0004 |
| Estado | TanStack Query (servidor) + Zustand (cliente) + Zod (fronteras) | 0006 |
| Dinero | `Money` en céntimos enteros; nunca `number` con decimales | 0007 |
| Diseño | **Midnight Glass** (oscuro + cristal, Sora, acento `#8C7BFF`); maquetación por pantalla en ADR-0009 | 0009 |
| Editor | VS Code (config en `.vscode/`) | 0010 |
| Flujo Git | Git Flow + Conventional Commits | 0005 |
| Monorepo | npm workspaces; `packages/*` sin build (TS borrable, imports `.ts`) | 0011 |
| ORM | Drizzle + `pg` + drizzle-kit | 0012 |
| Auth | Enlace mágico + JWT 15 min + refresh rotatorio; biometría solo local | 0013 |

## Estado
Fases 1–3 cerradas (releases **0.1.0**, **0.2.0** y **0.3.0**): monorepo y backend base; login sin contraseña y hogares; movimientos con caché persistida y altas optimistas, probadas en el emulador contra la API real (`EXPO_PUBLIC_DATA_SOURCE=api`, ver `docs/architecture/integracion-api.md`). Preparación global G.0 hecha (3.0–7.0; de la 6.0 falta lo que necesita al usuario). Backend de las fases 4, 5 y 7 hecho (pista A); sus cierres 4.9, 5.9 y 7.9 esperan a la pista B.

## Plan de desarrollo
- Plan completo por fases: `docs/plan/README.md` (estado) y `docs/plan/fase-*.md` (tareas con prompt).
- **Dos pistas en paralelo:** A = Opus (carpeta `iCount`), B = Sonnet (worktree `iCount-b`). Las reglas para no pisarse están en `docs/plan/PROTOCOLO.md`; respétalas siempre.
- Comandos: `/tarea <ID>` ejecuta una tarea; `/estado` dice qué toca; `/planificar <idea>` crea una fase nueva.

## Convenciones de código
- `features/<f>/{domain,data,presentation}` + `<f>.module.ts`. `domain` es TS puro (sin React/RN/Expo).
- ViewModel = custom hook `use<Screen>ViewModel` → `{ state, ...acciones }`; `state` es una unión discriminada; la View solo pinta.
- Implementaciones concretas solo en módulos de feature y `core/di/container.ts`.
- Vistas: solo tokens de `shared/ui/theme.ts` y componentes de `shared/ui`; nada de colores literales.
- Rutas de `mobile/src/app/` finas: re-exportan pantallas de `features/`.
- `npm install` siempre en la raíz. Dependencias de la app con `npx expo install` (desde `mobile/`); solo en las tareas `X.0` / `X.9` (ver protocolo).
- Antes de dar algo por hecho: `npm run lint && npm run typecheck && npm test` en cada paquete tocado (`-w <paquete>`) o `npm run verify` en la raíz.

## Documentación obligatoria
- Decisión técnica → ADR (`docs/adr/`, plantilla `0000-plantilla.md`; números según el protocolo).
- Feature → `docs/features/<f>.md` (pista B) o `docs/backend/`, `docs/architecture/` (pista A), siempre con "Para la entrevista".
- El usuario viene de Android (Kotlin/KMP) e iOS (SwiftUI): explica con analogías a esos stacks. Idioma: español.

## Git
Ramas `feature/<id>-<slug>` desde `develop`. **Sin PR** (decisión del 2026-10-14: la espera de CI frenaba el trabajo): se verifica en local (`npm run verify`), se hace `git fetch && git rebase origin/develop` y se integra con `git push origin HEAD:develop` (solo avance rápido, sin `--force`). La CI de `develop` es la red de seguridad: si falla, quien la rompió la arregla en seguida. Releases `release/0.X.0` al cerrar cada fase. Nunca commitear directo en `main`.
