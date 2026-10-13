# iCount — guía para Claude

Monorepo: `mobile/` (Expo + React Native + TS), `backend/` (pendiente, ver ADR-0004), `docs/`.
Lee también `mobile/AGENTS.md` antes de tocar APIs de Expo: consulta la doc versionada, no la memoria.

## Convenciones
- Arquitectura: Clean Architecture + MVVM por feature (`mobile/src/features/<f>/{domain,data,presentation}`).
  - `domain` es TypeScript puro: sin imports de React / React Native / Expo.
  - ViewModel = custom hook `use<Screen>ViewModel` que devuelve `{ state, ...acciones }`; la View solo pinta.
  - Implementaciones concretas solo se instancian en `mobile/src/core/di/container.ts`.
  - Dinero siempre con `Money` (unidades menores enteras). Nunca `number` con decimales.
- Rutas en `mobile/src/app/` son finas: re-exportan pantallas de `features/`.
- Instala dependencias con `npx expo install`, no `npm install <pkg>`.
- Antes de dar algo por terminado (en `mobile/`): `npm run lint && npm run typecheck && npm test`.

## Documentación obligatoria
Cada decisión técnica → ADR en `docs/adr/NNNN-titulo.md` (plantilla `0000-plantilla.md`).
Cada feature → `docs/features/<feature>.md` explicando qué, cómo y por qué, con sección "Para la entrevista".
El usuario viene de Android (Kotlin/KMP) e iOS (SwiftUI): explica con analogías a esos stacks.

## Git
Git Flow: ramas `feature/<nombre>` desde `develop`; merge `--no-ff` a `develop`. Nunca commitear directo a `main`.
Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
