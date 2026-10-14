# Fase 5 · Hogar compartido → release 0.5.0 (candidata a MVP)

**Objetivo:** la economía conjunta completa: quién ha pagado, cuánto le toca a cada uno, saldar cuentas, actividad del hogar con aprobaciones, notificaciones push y tests E2E de los flujos críticos. Pantalla del lienzo: 09-C, con la cabecera de balance de 09-A.

---

## [x] 5.0 · Preparación — Opus, en solitario
- **Rama:** `feature/5.0-preparacion-hogar` · **Depende de:** fase 4 ✅
- **Hecho cuando:**
  - ADR-0016 (balances y liquidaciones): balance neto por miembro y algoritmo voraz de mínimas transferencias; cómo afectan los movimientos pendientes de aprobar.
  - ADR-0017 (notificaciones push): Expo Push Service, tokens por dispositivo y eventos que notifican.
  - Dependencias: backend `expo-server-sdk`; app `expo-device` (más lo que pida la doc de notificaciones push de SDK 57).
  - Contratos de balances, liquidaciones, actividad (con estado de aprobación) y registro de token push.
  - Puertos `SettlementRepository`, `ActivityRepository` y `PushRepository`, y módulos stub.
  - Fase 5 → 🚧.
- **Prompt:**
```
Tarea 5.0 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Prepara la fase 5 según docs/plan/fase-5-hogar-compartido.md: ADR-0016 (balances netos + mínimas transferencias; efecto de movimientos pendientes de aprobación) y ADR-0017 (push con Expo Push Service; consulta la doc de SDK 57), dependencias, contratos zod, puertos y módulos stub. Marca estados en docs/plan/README.md.
```

---

## Pista A · Opus

### [x] A-5.1 · Backend: balances, liquidaciones, actividad y aprobaciones
- **Rama:** `feature/a-5.1-backend-balances` · **Depende de:** 5.0
- **Ficheros exclusivos:** `backend/**`, `mobile/src/features/{settlements,activity}/data/api/**`, `docs/backend/hogar-compartido.md`
- **Hecho cuando:** balance neto por miembro y periodo; sugerencia de mínimas transferencias; registrar una liquidación; feed de actividad (alta, edición, pago, liquidación); los movimientos compartidos añadidos por otro miembro quedan "pendientes" hasta aprobarse; comentarios; repositorios de API en la app; tests (3 o más miembros, céntimos impares).
- **Prompt:**
```
Tarea A-5.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Backend: módulo settlements (balance neto por miembro, algoritmo de mínimas transferencias según ADR-0016, registrar liquidación) y módulo activity (feed de eventos del hogar, aprobación de movimientos compartidos añadidos por otros, comentarios). App: ApiSettlementRepository y ApiActivityRepository.
Tests con 3+ miembros y céntimos impares. docs/backend/hogar-compartido.md.
```

### [ ] A-5.2 · Notificaciones push de punta a punta
- **Rama:** `feature/a-5.2-push` · **Depende de:** A-5.1
- **Ficheros exclusivos:** `backend/**`, `mobile/src/core/notifications/**`, `mobile/src/features/push/data/api/**`, `docs/architecture/push.md`
- **Hecho cuando:** la app registra el token push tras el login; el backend envía notificaciones en "nuevo gasto compartido", "aprobación pendiente" y "recordatorio de saldar", con limpieza de tokens inválidos; tocar la notificación abre la ruta correcta (deep link); tests del emisor con el SDK simulado.
- **Prompt:**
```
Tarea A-5.2 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Push de punta a punta: en la app core/notifications (permiso en contexto, registro del Expo push token tras login, manejo de toque → deep link a la ruta adecuada); en el backend un servicio de envío con expo-server-sdk para los eventos de ADR-0017, en lotes, con limpieza de tokens inválidos a partir de los receipts. Tests con el SDK mockeado. docs/architecture/push.md.
```

---

## Pista B · Sonnet

### [ ] B-5.1 · Hogar: actividad y balance (09-C)
- **Rama:** `feature/b-5.1-hogar` · **Depende de:** 5.0
- **Ficheros exclusivos:** `mobile/src/features/{activity,settlements}/{domain/usecases,data/InMemory*,presentation}/**`, sus `*.module.ts`, `mobile/src/app/(tabs)/household*`, `docs/features/hogar.md`
- **Hecho cuando:** pestaña Hogar con cabecera de balance ("Leo debe a Ana…"), feed de actividad con filtro "por revisar", aprobar y comentar, y gestión de miembros (invitar, ver ingresos y regla de reparto); tests.
- **Prompt:**
```
Tarea B-5.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Implementa la pestaña Hogar (pantalla 09, maquetación C "actividad", con la cabecera de balance de la maquetación A): balance entre miembros, feed de actividad con filtro "por revisar", aprobar y comentar movimientos, y sección de miembros (invitar, reparto). Casos de uso + InMemory + módulos. Tests. docs/features/hogar.md.
```

### [ ] B-5.2 · Saldar cuentas
- **Rama:** `feature/b-5.2-saldar` · **Depende de:** B-5.1
- **Ficheros exclusivos:** `mobile/src/features/settlements/presentation/settle/**`, `mobile/src/app/settle/**`, `docs/features/saldar-cuentas.md`
- **Hecho cuando:** flujo de saldar (transferencias sugeridas, importe editable, nota y método), confirmación con *haptics*, historial de liquidaciones; tests.
- **Prompt:**
```
Tarea B-5.2 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Implementa el flujo "Saldar cuentas": ver transferencias sugeridas, ajustar importe, nota y método, confirmar (haptics) y ver historial de liquidaciones. Tests de ViewModel. docs/features/saldar-cuentas.md.
```

### [ ] B-5.3 · Tests E2E con Maestro
- **Rama:** `feature/b-5.3-e2e` · **Depende de:** B-5.2
- **Ficheros exclusivos:** `mobile/e2e/**`, `.github/workflows/mobile-e2e.yml`, `docs/features/e2e.md`
- **Hecho cuando:** flujos Maestro en modo memoria: onboarding → acceso → crear hogar; añadir gasto y verlo en Inicio e Historial; aprobar un movimiento; saldar cuentas. `testID` estables. Instrucciones para ejecutarlo en local con el emulador.
- **Prompt:**
```
Tarea B-5.3 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Añade tests E2E con Maestro en mobile/e2e para los flujos críticos (onboarding→acceso→crear hogar; añadir gasto y verlo en Inicio e Historial; aprobar; saldar) en dataSource memory, añadiendo testID donde falten. Documenta cómo ejecutarlos en Windows con el emulador (docs/features/e2e.md). Si es viable, workflow mobile-e2e.yml manual (workflow_dispatch).
```

---

## [ ] 5.9 · Integración y cierre — Opus, en solitario
- **Hecho cuando:** módulos en modo `api`; prueba con dos dispositivos o emuladores y dos usuarios (gasto compartido → push → aprobar → saldar); E2E en verde; fase 5 → ✅; release `0.5.0` (candidata a MVP).
- **Prompt:**
```
Tarea 5.9 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Integra la fase 5 en modo api y prueba con dos usuarios el ciclo gasto compartido → push → aprobación → saldar. Ejecuta los E2E de Maestro. Corrige, actualiza docs de estado, marca la fase 5 ✅ y publica la release 0.5.0.
```
