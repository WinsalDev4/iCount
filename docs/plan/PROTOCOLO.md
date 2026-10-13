# Protocolo de trabajo en dos pistas

Dos sesiones de Claude Code trabajan en paralelo sobre iCount sin pisarse:

| Pista | Modelo | Carpeta de trabajo | Qué hace | Puertos |
|---|---|---|---|---|
| **A** | **Opus** | `E:\Documentos\GIT\iCount` | Arquitectura y lo difícil: backend, contratos, red/auth/offline en la app, motor financiero, IA, seguridad, despliegue. **También las tareas `X.0` (preparación) y `X.9` (integración y cierre) de cada fase.** | Metro 8081 · API 3000 · Postgres 5432 |
| **B** | **Sonnet** | `E:\Documentos\GIT\iCount-b` (git worktree) | Producto visible: design system, navegación, pantallas (dominio de cliente + ViewModel + vista), tests de UI, E2E | Metro 8082 |

## Ciclo de una fase

```
X.0 Preparación (A, en solitario)  →  A-X.n ∥ B-X.n (en paralelo)  →  X.9 Integración y cierre (A, en solitario)
```

- **X.0** instala **todas** las dependencias de la fase (app y backend), define los **puertos** (interfaces de repositorio) y deja preparados los **módulos** de cada feature y el contenedor de DI. Así, durante el trabajo en paralelo nadie toca `package.json`, `package-lock.json` ni `core/di/container.ts`.
- **En paralelo**, cada tarea solo modifica los **ficheros exclusivos** que lista. Si una tarea tiene `Depende de`, no se empieza hasta que esa dependencia esté marcada `[x]` y fusionada en `develop`.
- **X.9** conecta las implementaciones reales (API) con las pantallas, prueba la fase de punta a punta, marca la fase como hecha en [README.md](README.md), y publica una release con Git Flow (`release/0.X.0` → `main` + tag).

## Reglas para no pisarse

1. **Propiedad de ficheros** (salvo lo que diga cada tarea):

   | Pista A posee | Pista B posee |
   |---|---|
   | `backend/**` | `mobile/src/app/**` (rutas) |
   | `packages/**` (contratos, motor financiero) | `mobile/src/shared/**` (design system) |
   | `mobile/src/core/**` (red, auth, config, DI) | `mobile/src/features/*/domain/**` (casos de uso; los puertos los crea X.0) |
   | `mobile/src/features/*/data/api/**` | `mobile/src/features/*/data/InMemory*.ts` |
   | `docs/backend/**`, `docs/architecture/**` | `mobile/src/features/*/presentation/**` |
   | `.github/workflows/backend-*.yml` | `mobile/src/features/*/<feature>.module.ts` (durante el paralelo) |
   | | `docs/features/**`, `mobile/e2e/**` |

2. **Ficheros calientes** (solo en `X.0` o `X.9`): `package.json`, `package-lock.json`, `mobile/app.json`, `mobile/src/core/di/container.ts`, `CLAUDE.md`, `README.md`, `docs/plan/README.md`.
3. **¿Dependencia no prevista?** Pista A puede añadirla solo en `backend/`. Pista B **no** instala nada en paralelo: lo anota en su PR y se instala en `X.9`, o se pide al usuario. Si aun así hay conflicto en `package-lock.json`: quedarse con el de `develop` y ejecutar `npm install`.
4. **ADRs**: las previstas tienen número asignado en el plan. Las no previstas: pista A usa `0100–0199`, pista B `0200–0299`.
5. **Plan**: cada tarea marca **solo su propia casilla** en `docs/plan/fase-X-*.md` dentro de su PR. Al estar en secciones distintas, git fusiona sin conflicto.
6. **Ramas**: `feature/<id-en-minúsculas>-<slug>` creada desde `origin/develop`, por ejemplo `feature/a-1.1-backend-base`. PR a `develop`. Antes de abrirlo: `git fetch && git rebase origin/develop`.
7. **Nunca hagas `git checkout develop` en la carpeta `iCount-b`.** Git no permite la misma rama activa en dos carpetas. Solo la carpeta `iCount` (pista A) puede activar `develop` o `main`, y solo para las releases de `X.9`.

## Pasos de cualquier tarea (lo que hace `/tarea <ID>`)

1. `git fetch origin`. Comprueba en `origin/develop` que las dependencias de la tarea están `[x]` (`git show origin/develop:docs/plan/fase-X-….md`). Si no, **para y avisa**.
2. `git switch -c feature/<id>-<slug> origin/develop`. Si hay cambios sin commitear de otra tarea, para y avisa.
3. Lee **solo**: `CLAUDE.md`, este protocolo, la sección de la tarea y los ficheros que cite. No explores el repo entero.
4. Implementa respetando la arquitectura (ADR-0003): dominio puro → datos → presentación. Tests primero en dominio.
5. Documenta: ADR si la tarea la pide (o si tomas una decisión relevante); página de feature (B) o de backend/arquitectura (A) con la sección "Para la entrevista".
6. Verifica: `npm run lint && npm run typecheck && npm test` en cada paquete tocado. Todo en verde.
7. Marca tu casilla `[x]` en el fichero de la fase. Haz commits atómicos (Conventional Commits) y abre el PR a `develop` con la plantilla.
8. Responde con un resumen breve: qué se hizo, el PR y lo que queda pendiente o bloqueado.

## Poner en marcha las dos sesiones (una vez)

```bash
cd E:/Documentos/GIT/iCount
git fetch origin
git worktree add --detach ../iCount-b origin/develop
```

(`--detach` evita activar `develop` en la segunda carpeta: cada tarea crea su rama desde `origin/develop`.)

- Sesión **Opus** → carpeta `iCount`. Sesión **Sonnet** → carpeta `iCount-b`.
- Cada carpeta tiene su propio `node_modules`: tras cada `X.0` fusionado, en **las dos**, `npm install` al empezar la siguiente tarea (la rama nueva ya sale de `origin/develop` actualizado).
- El modelo se elige en el selector de modelo de cada sesión: Opus en la de `iCount` y Sonnet en la de `iCount-b`.
- Pista B arranca Metro con `npx expo start --port 8082`.
- Prompt de inicio de sesión: `/tarea <ID>` (o `/estado` para ver qué toca).

## Definición de hecho
- Lint, typecheck y tests en verde, y CI en verde en el PR.
- Sin `any`, sin colores ni importes literales en vistas (tokens y `Money`).
- Documentación actualizada y casilla marcada.
- El PR describe cómo probarlo.
