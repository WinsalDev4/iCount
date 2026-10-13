# Fase 1 · Cimientos → release 0.1.0

**Objetivo:** monorepo con workspaces, backend NestJS arrancando contra PostgreSQL, contratos compartidos, capa de red de la app, design system Midnight Glass y navegación por pestañas. Al acabar, la app abre con la barra de pestañas y el estilo definitivo, y `GET /health` responde.

---

## [x] 1.0 · Preparación de la fase — Opus, en solitario
- **Rama:** `feature/1.0-preparacion-cimientos` · **Depende de:** fase 0
- **Ficheros:** todos los calientes (`package.json` raíz, lockfile, `mobile/package.json`, `mobile/app.json`, `mobile/metro.config.js`, `.github/workflows/mobile-ci.yml`, `core/di/container.ts`, `docs/plan/README.md`), `backend/` (andamiaje), `packages/contracts/` (esqueleto), ADR-0011 y ADR-0012.
- **Hecho cuando:**
  - `npm install` en la raíz instala `mobile`, `backend` y `packages/*`; CI de mobile adaptado y en verde.
  - `backend/` creado con Nest CLI; `docker compose up -d` levanta PostgreSQL 17; `npm run start:dev -w backend` arranca.
  - `@icount/contracts` importable desde la app (Metro) y desde el backend, con un test trivial que lo demuestra.
  - Dependencias de la fase instaladas (lista en el prompt).
  - La feature `transactions` está migrada al patrón de módulo: `features/transactions/transactions.module.ts` exporta `createTransactionsModule({ dataSource })`, y `container.ts` compone módulos. `core/config/env.ts` mínimo con `dataSource: 'memory' | 'api'` (`EXPO_PUBLIC_DATA_SOURCE`, por defecto `memory`).
  - `docs/plan/README.md`: fase 1 → 🚧.
- **Prompt:**
```
Tarea 1.0 de iCount (sigue docs/plan/PROTOCOLO.md; eres la pista A, Opus).
Prepara la fase 1 para que las pistas A y B trabajen luego en paralelo sin tocar ficheros compartidos:
1) Monorepo con npm workspaces ["mobile","backend","packages/*"]. Consulta la guía de monorepos de Expo para SDK 57 (docs.expo.dev) antes de tocar metro.config.js; no adivines. Mueve el lockfile a la raíz y adapta .github/workflows/mobile-ci.yml. ADR-0011.
2) backend/: andamiaje con Nest CLI (npm, sin git), docker-compose.yml en la raíz con PostgreSQL 17, .env.example. Decide el ORM (Prisma vs Drizzle) con argumentos para entrevista y deja instalado el elegido: ADR-0012.
3) packages/contracts (@icount/contracts): TypeScript sin paso de build, zod como dependencia, Jest configurado y un test.
4) Instala en mobile con `npx expo install`: expo-font @expo-google-fonts/sora expo-splash-screen expo-blur react-native-svg react-native-reanimated expo-haptics. Comprueba plugins de app.json.
5) Patrón de módulo por feature y core/config/env.ts según los criterios de docs/plan/fase-1-cimientos.md; el slice transactions sigue funcionando y sus tests pasan.
6) Marca la fase 1 como 🚧 en docs/plan/README.md y tu casilla.
Verifica lint/typecheck/test en todos los paquetes. PR a develop.
```

---

## Pista A · Opus

### [ ] A-1.1 · Backend base
- **Rama:** `feature/a-1.1-backend-base` · **Depende de:** 1.0
- **Ficheros exclusivos:** `backend/**`, `.github/workflows/backend-ci.yml`, `docs/backend/**`
- **Hecho cuando:** estructura Clean Architecture en `backend/src/{shared,modules}`; configuración validada con zod al arrancar; filtro global de errores con formato *problem details* (RFC 9457); pipe de validación con zod; `GET /health` comprueba la BD; primera migración; OpenAPI en `/docs`; tests unitarios y e2e (supertest) contra Postgres; workflow de CI del backend con servicio Postgres; `docs/backend/arquitectura.md` con "Para la entrevista".
- **Prompt:**
```
Tarea A-1.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Construye la base del backend NestJS en backend/ con Clean Architecture por módulo (domain / application / infrastructure / interface), siguiendo ADR-0004 y el ORM del ADR-0012.
Incluye: config validada con zod, logger estructurado, filtro global de errores RFC 9457, pipe de validación zod, módulo health con check de BD, primera migración, OpenAPI en /docs, tests unitarios + e2e con supertest contra el Postgres de docker compose, y .github/workflows/backend-ci.yml con servicio Postgres.
Deja un módulo de ejemplo mínimo que sirva de plantilla para los siguientes (explícalo en docs/backend/arquitectura.md, con analogías a Spring Boot).
Solo toca backend/**, .github/workflows/backend-ci.yml y docs/backend/**.
```

### [ ] A-1.2 · Contratos compartidos base
- **Rama:** `feature/a-1.2-contratos-base` · **Depende de:** 1.0
- **Ficheros exclusivos:** `packages/contracts/**`, `docs/architecture/contratos.md`
- **Hecho cuando:** esquemas zod con tipos inferidos para `MoneyDto` (`amountMinor` entero seguro + `currency`), IDs con marca de tipo (*branded*), paginación por cursor, `ProblemDetails`, `CategoryId` y `CurrencyCode`; tests de validación; documentación de cómo versionar contratos.
- **Prompt:**
```
Tarea A-1.2 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
En packages/contracts crea los contratos base compartidos entre API y app con zod (tipos con z.infer): MoneyDto (amountMinor entero seguro + currency, coherente con mobile/src/core/domain/Money.ts y ADR-0007), IDs branded (UserId, HouseholdId, TransactionId), paginación por cursor (request/response genéricos), ProblemDetails (RFC 9457), CategoryId y CurrencyCode.
Tests de casos válidos e inválidos. Explica en docs/architecture/contratos.md por qué contratos compartidos y cómo evolucionarlos sin romper versiones antiguas de la app.
Solo toca packages/contracts/** y docs/architecture/contratos.md.
```

### [ ] A-1.3 · Capa de red de la app
- **Rama:** `feature/a-1.3-red-app` · **Depende de:** 1.0, A-1.2
- **Ficheros exclusivos:** `mobile/src/core/network/**`, `mobile/src/core/config/**`, `mobile/src/core/query/**`, `mobile/src/core/domain/Result.ts`, `docs/architecture/red.md`
- **Hecho cuando:** `httpClient` sobre `fetch` con URL base de `env`, timeout con `AbortController`, parseo de la respuesta con un esquema zod, errores tipados (red, timeout, HTTP con `ProblemDetails`, validación) y tipo `Result`; `queryClient` con política de reintentos (no reintentar 4xx) y `staleTime`; tests con `fetch` simulado.
- **Prompt:**
```
Tarea A-1.3 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Crea la capa de red de la app en mobile/src/core: config/env.ts (EXPO_PUBLIC_API_URL, dataSource), network/httpClient.ts (fetch + timeout con AbortController + validación de respuesta con esquemas zod de @icount/contracts + errores tipados: Network, Timeout, Http con ProblemDetails, Validation), domain/Result.ts, y query/queryClient.ts (factoría con reintentos solo en errores de red/5xx y staleTime razonable).
Si root _layout crea el QueryClient, deja la factoría lista y anótalo para que 1.9 la conecte (no toques src/app).
Tests con fetch mockeado. Documenta en docs/architecture/red.md con analogías a Retrofit/OkHttp y URLSession.
```

---

## Pista B · Sonnet

### [x] B-1.1 · Design system Midnight Glass
- **Rama:** `feature/b-1.1-design-system` · **Depende de:** 1.0
- **Ficheros exclusivos:** `mobile/src/shared/ui/**`, `mobile/src/app/_layout.tsx`, `mobile/src/app/dev/**`, `docs/features/design-system.md`
- **Hecho cuando:** fuente Sora cargada (splash hasta que carga); componentes con props tipadas y accesibilidad: `Screen` (fondo con los dos resplandores SVG y área segura), `GlassCard` (BlurView, con *fallback* sin desenfoque), `AppText` (variantes de `theme.typography`), `Button` (primario, secundario, fantasma, cargando), `IconButton`, `Chip`, `SegmentedControl`, `ProgressBar`, `ProgressRing`, `Donut`, `Avatar` y `AvatarStack`, `ListItem`, `Icon` (iconos SVG de trazo: inicio, historial, más, planificar, hogar, atrás, enviar); test de cada componente; catálogo visible en `/dev/catalog` (solo en `__DEV__`).
- **Prompt:**
```
Tarea B-1.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Implementa el design system "Midnight Glass" (ADR-0009) en mobile/src/shared/ui usando SOLO los tokens de theme.ts. Referencia visual: propuesta 02 de cada página del lienzo (docs/design/README.md).
Carga Sora (@expo-google-fonts/sora) en src/app/_layout.tsx manteniendo el splash hasta que cargue (consulta la doc de expo-font y expo-splash-screen de SDK 57).
Componentes: Screen (fondo #0B0C1A + 2 resplandores radiales con react-native-svg + safe area), GlassCard (expo-blur con fallback semitransparente), AppText (variantes de theme.typography), Button (primary/secondary/ghost/loading), IconButton, Chip, SegmentedControl, ProgressBar, ProgressRing, Donut (svg), Avatar y AvatarStack, ListItem, Icon (svg de trazo: home, list, plus, target, users, back, send).
Accesibilidad: accessibilityRole y labels; áreas táctiles ≥ 44 pt. Un test por componente con Testing Library. Catálogo en src/app/dev/catalog.tsx solo en __DEV__.
Documenta en docs/features/design-system.md (analogía: un MaterialTheme / design system de SwiftUI).
No instales dependencias; si falta alguna, anótala en el PR.
```

### [ ] B-1.2 · Navegación por pestañas
- **Rama:** `feature/b-1.2-navegacion` · **Depende de:** B-1.1
- **Ficheros exclusivos:** `mobile/src/app/**` (salvo `_layout.tsx` raíz, solo para registrar grupos), `mobile/src/shared/ui/TabBar*`, `docs/features/navegacion.md`
- **Hecho cuando:** grupo `(tabs)` con TabBar de cristal propia (Inicio, Historial, botón central +, Planificar, Hogar); el + abre la ruta modal `add`; pantallas provisionales con el design system; la pantalla actual de transactions pasa a Inicio; rutas tipadas; deep link `icount://` probado; test del TabBar.
- **Prompt:**
```
Tarea B-1.2 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Monta la navegación con Expo Router (consulta la doc de SDK 57 sobre tabs con barra personalizada y rutas modales):
grupo (tabs) con TabBar de cristal propia (Inicio, Historial, FAB central "+", Planificar, Hogar) como en el lienzo; el FAB abre la ruta modal add; pantallas provisionales con Screen/AppText; mueve la pantalla actual de transactions a (tabs)/index.
Rutas finas (solo re-exportan pantallas de features/*/presentation). Test del TabBar. Documenta en docs/features/navegacion.md con analogía a Navigation Compose / NavigationStack + TabView.
```

---

## [ ] 1.9 · Integración y cierre — Opus, en solitario
- **Rama:** `feature/1.9-cierre-cimientos` y después `release/0.1.0`
- **Depende de:** A-1.1, A-1.2, A-1.3, B-1.1, B-1.2
- **Hecho cuando:** `QueryClient` del layout usa la factoría de `core/query`; la app compila y abre en el emulador Android con fuentes, cristal y pestañas; backend y Postgres arrancan con docker compose y responden a `/health`; dependencias anotadas por B instaladas; README raíz y `CLAUDE.md` actualizados; fase 1 → ✅ en `docs/plan/README.md`; release `0.1.0` con Git Flow (versión en `app.json` y `package.json`), tag `v0.1.0` y push de `main`, `develop` y tags.
- **Prompt:**
```
Tarea 1.9 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Integra la fase 1: revisa los PR fusionados, instala dependencias que B haya anotado, conecta _layout con core/query/queryClient, ejecuta lint/typecheck/test en todos los paquetes, compila en Android (npm run android -w mobile) y comprueba visualmente pestañas, fuente y cristal; levanta docker compose + backend y comprueba /health.
Actualiza README raíz y CLAUDE.md (estado del proyecto), marca la fase 1 como ✅ y haz la release 0.1.0 con git flow (sube versión en app.json y package.json), tag v0.1.0 y push de main, develop y tags.
```
