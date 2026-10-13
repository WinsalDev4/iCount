# Fase 2 · Identidad y hogar → release 0.2.0

**Objetivo:** el usuario ve el onboarding, entra sin contraseña (enlace mágico y biometría para desbloquear), crea un hogar o se une con un código, y elige la regla de reparto. Pantallas del lienzo: 01-B, 02-C y 03-A.

---

## [x] 2.0 · Preparación — Opus, en solitario
- **Rama:** `feature/2.0-preparacion-identidad` · **Depende de:** fase 1 ✅
- **Hecho cuando:**
  - ADR-0013 (autenticación): enlace mágico por email, JWT de acceso de 15 min, refresh token rotatorio guardado con hash y detección de reutilización, y biometría solo como desbloqueo local.
  - Dependencias instaladas. Backend: `@nestjs/jwt`, `@nestjs/throttler`. App: `expo-secure-store`, `expo-local-authentication`, `@react-native-async-storage/async-storage`. Mailpit en docker compose para ver emails en desarrollo.
  - Contratos en `@icount/contracts`: auth (solicitar enlace, verificar, refresh, sesión) y household (crear, invitación, unirse, miembros, `SplitRule`: partes iguales, proporcional a ingresos o a medida por categoría).
  - Puertos en la app: `features/auth/domain/AuthRepository.ts` y `features/household/domain/HouseholdRepository.ts`, con entidades `User`, `Session`, `Household`, `Member` y `SplitRule`.
  - Módulos `auth.module.ts` y `household.module.ts` vacíos (lanzan "no implementado") registrados en `container.ts`.
  - Fase 1 → ✅ (si 1.9 no lo hizo) y fase 2 → 🚧.
- **Prompt:**
```
Tarea 2.0 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Prepara la fase 2 según docs/plan/fase-2-identidad-y-hogar.md: escribe ADR-0013 (auth sin contraseña con JWT + refresh rotatorio, biometría local), instala dependencias de backend y app (npx expo install en mobile), añade Mailpit a docker compose, crea los contratos zod de auth y household en packages/contracts, define puertos y entidades de dominio de auth y household en la app (TS puro) y deja módulos stub registrados en container.ts.
No implementes casos de uso ni pantallas (son de la pista B) ni endpoints (A-2.1/A-2.2). Marca estados en docs/plan/README.md.
```

---

## Pista A · Opus

### [x] A-2.1 · Backend: autenticación
- **Rama:** `feature/a-2.1-backend-auth` · **Depende de:** 2.0
- **Ficheros exclusivos:** `backend/**`, `docs/backend/auth.md`
- **Hecho cuando:** tablas de usuarios, tokens mágicos (un solo uso, 15 min, guardados con hash) y refresh tokens; endpoints `POST /auth/magic-link`, `/auth/verify`, `/auth/refresh` y `/auth/logout`; guard JWT; límite de peticiones en `magic-link`; adaptador de email detrás de una interfaz (Mailpit en desarrollo); el enlace abre `icount://auth/verify?token=…`; tests e2e (reutilización de refresh token → revocación de la familia).
- **Prompt:**
```
Tarea A-2.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Implementa el módulo auth del backend según ADR-0013 y los contratos de @icount/contracts: magic link de un solo uso (hash, 15 min), verify → access JWT (15 min) + refresh rotatorio con detección de reutilización (revoca la familia), refresh, logout, guard JWT, throttling en magic-link, EmailSender como puerto con adaptador SMTP→Mailpit. El enlace del email es icount://auth/verify?token=...
Tests e2e de los flujos felices y de abuso. Documenta en docs/backend/auth.md (amenazas cubiertas, para la entrevista).
```

### [x] A-2.2 · Backend: hogares
- **Rama:** `feature/a-2.2-backend-hogares` · **Depende de:** A-2.1
- **Ficheros exclusivos:** `backend/**`, `docs/backend/hogares.md`
- **Hecho cuando:** hogares, miembros (rol administrador o miembro), invitaciones (código de 8 caracteres, 48 h, un solo uso), regla de reparto e ingresos por miembro; autorización (solo los miembros acceden a su hogar); endpoints y tests.
- **Prompt:**
```
Tarea A-2.2 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Implementa el módulo households: crear hogar (el creador es admin), obtener los míos, crear invitación (código legible de 8 caracteres sin ambigüedades, 48 h, un uso), unirse por código, listar miembros, fijar SplitRule (equal | income-proportional | custom por categoría) y los ingresos declarados por miembro.
Autorización por pertenencia en todos los endpoints (tests que lo prueben). Contratos de @icount/contracts. Documenta en docs/backend/hogares.md.
```

### [ ] A-2.3 · App: sesión y repositorios de API
- **Rama:** `feature/a-2.3-sesion-app` · **Depende de:** 2.0 (contra contratos; no necesita el backend desplegado)
- **Ficheros exclusivos:** `mobile/src/core/auth/**`, `mobile/src/core/network/**`, `mobile/src/features/auth/data/api/**`, `mobile/src/features/household/data/api/**`, `docs/architecture/sesion.md`
- **Hecho cuando:** almacén de sesión en `expo-secure-store`; el `httpClient` añade el token y hace refresh *single-flight* (varias peticiones con 401 → un único refresh); cierre de sesión forzado si el refresh falla; servicio de biometría; `ApiAuthRepository` y `ApiHouseholdRepository` implementan los puertos; tests.
- **Prompt:**
```
Tarea A-2.3 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
En la app: core/auth con sessionStore (expo-secure-store), refresh single-flight integrado en core/network/httpClient (cola de peticiones durante el refresh, logout forzado si falla, evento observable de sesión expirada), y core/auth/biometrics.ts (expo-local-authentication).
Implementa ApiAuthRepository y ApiHouseholdRepository en features/*/data/api cumpliendo los puertos de dominio y validando con @icount/contracts. Tests (incluido: 3 peticiones concurrentes con 401 → 1 refresh).
Documenta en docs/architecture/sesion.md (analogía con OkHttp Authenticator).
```

---

## Pista B · Sonnet

### [x] B-2.1 · Onboarding (01-B)
- **Rama:** `feature/b-2.1-onboarding` · **Depende de:** 2.0
- **Ficheros exclusivos:** `mobile/src/features/onboarding/**`, `mobile/src/app/(onboarding)/**`, `docs/features/onboarding.md`
- **Hecho cuando:** 3 pasos con paginador animado (Reanimated), con la maquetación B "cifra protagonista"; "Saltar" y "Siguiente"; flag `onboardingCompleted` persistido (Zustand + AsyncStorage); tests del ViewModel.
- **Prompt:**
```
Tarea B-2.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Implementa la feature onboarding (pantalla 01, maquetación B "cifra protagonista" del lienzo): 3 pasos con paginador animado con Reanimated, botones Saltar/Siguiente, y store Zustand persistido (AsyncStorage) con onboardingCompleted.
MVVM: useOnboardingViewModel + vista; rutas en src/app/(onboarding). Tests del ViewModel. docs/features/onboarding.md.
```

### [ ] B-2.2 · Acceso sin contraseña (02-C) y protección de rutas
- **Rama:** `feature/b-2.2-acceso` · **Depende de:** B-2.1
- **Ficheros exclusivos:** `mobile/src/features/auth/{domain/usecases,data/InMemory*,presentation}/**`, `mobile/src/features/auth/auth.module.ts`, `mobile/src/app/(auth)/**`, `mobile/src/app/_layout.tsx`, `docs/features/acceso.md`
- **Hecho cuando:** casos de uso `RequestMagicLink`, `VerifyMagicLink`, `SignOut` y `GetSession`; `InMemoryAuthRepository` (en modo memoria acepta cualquier token); pantallas de email, "revisa tu correo" y la ruta `auth/verify` del deep link; interruptor de biometría; protección de rutas onboarding → auth → app con la API de rutas protegidas de Expo Router; tests.
- **Prompt:**
```
Tarea B-2.2 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Implementa la feature auth (pantalla 02, maquetación C "sin contraseña"): casos de uso RequestMagicLink, VerifyMagicLink, SignOut y GetSession contra el puerto AuthRepository ya definido; InMemoryAuthRepository; pantallas email → "revisa tu correo" → ruta auth/verify que recibe el token del deep link; opción de activar biometría.
Protege las rutas (onboarding → auth → app) con lo que recomiende la doc de Expo Router de SDK 57 para rutas protegidas. Rellena auth.module.ts con la implementación en memoria. Tests de casos de uso y ViewModels. docs/features/acceso.md.
```

### [ ] B-2.3 · Crear o unirse a un hogar (03-A)
- **Rama:** `feature/b-2.3-hogar-setup` · **Depende de:** B-2.2
- **Ficheros exclusivos:** `mobile/src/features/household/{domain/usecases,data/InMemory*,presentation}/**`, `mobile/src/features/household/household.module.ts`, `mobile/src/app/(setup)/**`, `docs/features/hogar-setup.md`
- **Hecho cuando:** elegir personal o compartida (tarjetas desplegables), nombre del hogar, compartir el código de invitación (API `Share` de React Native), unirse con un código, elegir la regla de reparto con vista previa; casos de uso `CreateHousehold`, `CreateInvite`, `JoinHousehold` y `SetSplitRule`; tests.
- **Prompt:**
```
Tarea B-2.3 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Implementa la configuración del hogar (pantalla 03, maquetación A "opciones desplegables"): personal vs compartida, nombre, código de invitación con Share nativo, unirse con código, y regla de reparto (50/50, según ingresos, a medida) con vista previa sobre un gasto de ejemplo.
Casos de uso CreateHousehold, CreateInvite, JoinHousehold y SetSplitRule contra HouseholdRepository; InMemoryHouseholdRepository; rellena household.module.ts. Rutas en src/app/(setup), integradas en la protección de rutas. Tests. docs/features/hogar-setup.md.
```

---

## [ ] 2.9 · Integración y cierre — Opus, en solitario
- **Depende de:** todas las tareas de la fase 2
- **Hecho cuando:** los módulos auth y household usan la implementación de API si `dataSource === 'api'`; flujo completo probado en el emulador (onboarding → email en Mailpit → deep link → crear hogar → invitar → unirse desde un segundo usuario); fase 2 → ✅; release `0.2.0`.
- **Prompt:**
```
Tarea 2.9 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Integra la fase 2: en auth.module.ts y household.module.ts selecciona la implementación Api* cuando env.dataSource === 'api'. Prueba en el emulador Android con backend + Mailpit el flujo completo (incluido un segundo usuario uniéndose por código) y corrige lo necesario. Actualiza CLAUDE.md/README, marca la fase 2 ✅ y publica la release 0.2.0 con git flow.
```
