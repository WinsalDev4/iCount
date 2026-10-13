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
- **Preparación global (G.0)**: las `X.0` de las fases 3, 4, 5 y 7 (y la parte técnica de la 6) se hacen **una sola vez, todas juntas**, en [fase-g-preparacion-global.md](fase-g-preparacion-global.md). Cumplida G.0, las pistas avanzan sin esperarse entre fases. Ver "Modo de preparación global" más abajo.
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
6. **Ramas**: `feature/<id-en-minúsculas>-<slug>` creada desde `origin/develop`, por ejemplo `feature/a-1.1-backend-base`. **Sin PR** (desde el 2026-10-14; donde este documento diga «PR», léase «integración en `develop`»): verificar en local, `git fetch && git rebase origin/develop` y `git push origin HEAD:develop` (solo avance rápido, nunca `--force`). Si el push es rechazado, repetir el rebase. La CI de `develop` es la red de seguridad: si falla, el autor lo arregla antes de seguir.
7. **Nunca hagas `git checkout develop` en la carpeta `iCount-b`.** Git no permite la misma rama activa en dos carpetas. Solo la carpeta `iCount` (pista A) puede activar `develop` o `main`, y solo para las releases de `X.9`.

## Modo de preparación global

Motivo: con una preparación por fase, la pista B se queda parada cada vez que acaba antes que A y tiene que esperar a la siguiente `X.0`. G.0 mueve esas preparaciones al principio.

**Qué cambia**
1. Una tarea **G.0** (Opus, en solitario) ejecuta de una vez las preparaciones `3.0`, `4.0`, `5.0` y `7.0` completas, y de la `6.0` solo la parte técnica (dependencias y contratos). Lo que necesita al usuario o una decisión tardía (`eas init`, ADR-0018 de hosting, ADR-0019 de observabilidad, variables por perfil) se queda en la `6.0`.
2. **Una dependencia `X.0` se considera cumplida cuando la `X.0` o la `G.0` están `[x]`** en `origin/develop` (para las fases que G.0 cubre). Los `Depende de: X.0` de los ficheros de fase no se reescriben.
3. **Cada pista avanza por su roadmap sin esperar a la otra**, respetando solo las dependencias reales que sigan escritas en cada tarea (por ejemplo B-4.2 necesita A-4.1). Las tareas de B trabajan contra repositorios en memoria que implementan los puertos.
4. Las `X.9` no cambian: las hace Opus en solitario cuando las tareas `A-X.n` y `B-X.n` de esa fase están `[x]`. Mientras tanto, B puede seguir con la fase siguiente.

**Reglas añadidas**
- **Un puerto no se cambia durante el paralelo.** Si B o A descubren que un puerto o un contrato está mal, paran esa tarea, lo anotan en el PR y pasan a otra. Lo corrige Opus en un PR pequeño `fix(ports): …` (o en la `X.9`). Los cambios *aditivos* (un método nuevo en un puerto que solo usa esa fase) los puede hacer Opus sin parar a la pista B.
- **`X.9` abierta = fase congelada para B.** Mientras el PR de integración de la fase X no esté fusionado, B no toca los `*.module.ts` ni `presentation/` de las features de esa fase; trabaja en la siguiente. Después, `git fetch && git rebase origin/develop`.
- **Dependencias nuevas no previstas**: se anotan en el PR y las instala Opus en la `X.9` (o en una tarea `chore(deps)` aparte). B nunca ejecuta `npm install <paquete>`.
- **G.0 es una tarea larga**: se divide en un PR por fase cubierta (`feature/g.0-fase-3`, `…-fase-4`…), fusionando cada uno en cuanto está en verde, para que B pueda empezar la fase 3 sin esperar a la 7.
- **Qué desbloquea cada PR de G.0**: el PR de la fase N (con su casilla `X.0` marcada) desbloquea las tareas `B-N.n`.

## Pasos de cualquier tarea (lo que hace `/tarea <ID>`)

1. `git fetch origin`. Comprueba en `origin/develop` que las dependencias de la tarea están `[x]` (`git show origin/develop:docs/plan/fase-X-….md`); una dependencia `X.0` también vale si su preparación aparece `[x]` en `fase-g-preparacion-global.md`. Si no, **para y avisa**.
2. `git switch -c feature/<id>-<slug> origin/develop`. Si hay cambios sin commitear de otra tarea, para y avisa.
3. Lee **solo**: `CLAUDE.md`, este protocolo, la sección de la tarea y los ficheros que cite. No explores el repo entero.
4. Implementa respetando la arquitectura (ADR-0003): dominio puro → datos → presentación. Tests primero en dominio.
5. Documenta: ADR si la tarea la pide (o si tomas una decisión relevante); página de feature (B) o de backend/arquitectura (A) con la sección "Para la entrevista".
6. Verifica: `npm run lint && npm run typecheck && npm test` en cada paquete tocado. Todo en verde.
7. Marca tu casilla `[x]` en el fichero de la fase. Haz commits atómicos (Conventional Commits) y intégralo en `develop` (ver regla 6; no se abre PR).
8. Responde con un resumen breve: qué se hizo, el commit integrado y lo que queda pendiente o bloqueado.

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
- La doc de la feature explica cómo probarla.
