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
Ramas `feature/<id>-<slug>` desde `develop`; PR a `develop`; releases `release/0.X.0` al cerrar cada fase. Nunca commitear directo a `main` ni a `develop`.
