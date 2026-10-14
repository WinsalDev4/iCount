# Fase 4 · Planificación → release 0.4.0

**Objetivo:** presupuestos por categoría con avisos, deudas con simulador de amortización y estrategias, y pagos recurrentes (facturas, letras) con recordatorios. Pantallas del lienzo: 07-A y 08-B (más la estrategia de 08-C como sección).

---

## [x] 4.0 · Preparación — Opus, en solitario
- **Rama:** `feature/4.0-preparacion-planificacion` · **Depende de:** fase 3 ✅
- **Hecho cuando:**
  - ADR-0015 (motor financiero compartido): paquete `packages/finance` en TypeScript puro, usado por la app (simulación offline) y por el backend (fuente de verdad); reglas de redondeo; amortización francesa.
  - Esqueleto de `@icount/finance` (paquete, Jest y un test).
  - Dependencias: backend `@nestjs/schedule`; app `expo-notifications`.
  - Contratos de presupuestos, deudas (principal, TAE, cuota, fecha de inicio, plazo) y pagos recurrentes (regla de periodicidad).
  - Puertos `BudgetRepository`, `DebtRepository` y `RecurringPaymentRepository`, y módulos stub registrados.
  - Fase 4 → 🚧.
- **Prompt:**
```
Tarea 4.0 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Prepara la fase 4 según docs/plan/fase-4-planificacion.md: ADR-0015 (motor financiero en packages/finance compartido app/backend, redondeos), esqueleto del paquete @icount/finance, dependencias (@nestjs/schedule; expo-notifications con npx expo install y su plugin), contratos zod de budgets/debts/recurring, puertos de dominio en la app y módulos stub en container.ts.
Marca estados en docs/plan/README.md.
```

---

## Pista A · Opus

### [x] A-4.1 · Motor financiero (`packages/finance`) — PRIORITARIA (B-4.2 depende de ella)
- **Rama:** `feature/a-4.1-motor-financiero` · **Depende de:** 4.0
- **Ficheros exclusivos:** `packages/finance/**`, `docs/architecture/motor-financiero.md`
- **Hecho cuando:** funciones puras sobre céntimos enteros: cuota francesa, cuadro de amortización, saldo pendiente a una fecha, simulación de amortización anticipada mensual (meses ahorrados e intereses ahorrados), estrategias **avalancha** y **bola de nieve** con varias deudas y aportación extra (fecha de fin por deuda e intereses totales); tests contrastados con cuadros conocidos; documentación con las fórmulas.
- **Prompt:**
```
Tarea A-4.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Implementa @icount/finance (TS puro, céntimos enteros, redondeo explícito y documentado): cuota de amortización francesa, cuadro de amortización, saldo pendiente a fecha, simulación de pago extra mensual (meses e intereses ahorrados) y estrategias avalancha/bola de nieve para N deudas con aportación extra (orden, fecha de fin por deuda, intereses totales).
Tests contra cuadros de referencia calculados (incluye el caso del lienzo: coche 8.640 € al 6,9% con 320 €/mes y +100 €/mes). Explica fórmulas y decisiones en docs/architecture/motor-financiero.md.
```

### [x] A-4.2 · Backend: presupuestos y pagos recurrentes
- **Rama:** `feature/a-4.2-backend-presupuestos-recurrentes` · **Depende de:** A-4.1
- **Ficheros exclusivos:** `backend/**`, `docs/backend/planificacion.md`
- **Hecho cuando:** presupuestos por categoría y mes, con gasto acumulado calculado; pagos recurrentes (mensual, anual, cada N meses, día del mes con ajuste a fin de mes); tarea programada idempotente que materializa los movimientos y los vencimientos próximos; tests.
- **Prompt:**
```
Tarea A-4.2 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Backend: módulo budgets (límite por categoría/mes, gasto acumulado y restante) y módulo recurring (reglas de periodicidad con ajuste de fin de mes, job programado idempotente con @nestjs/schedule que materializa transacciones y calcula próximos vencimientos). Tests (idempotencia del job incluida). docs/backend/planificacion.md.
```

### [x] A-4.3 · Backend de deudas + repositorios de API de la fase
- **Rama:** `feature/a-4.3-deudas-y-datos` · **Depende de:** A-4.2
- **Ficheros exclusivos:** `backend/**`, `mobile/src/features/{budgets,debts,recurring}/data/api/**`, `docs/backend/deudas.md`
- **Hecho cuando:** CRUD de deudas, pagos enlazados a movimientos de la categoría Préstamos, cuadro de amortización y estrategia calculados con `@icount/finance`; en la app, `ApiBudgetRepository`, `ApiDebtRepository` y `ApiRecurringPaymentRepository`; tests.
- **Prompt:**
```
Tarea A-4.3 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Backend: módulo debts (CRUD, pagos enlazados a transacciones de la categoría préstamos, endpoints de cuadro y estrategia usando @icount/finance). App: ApiBudgetRepository, ApiDebtRepository y ApiRecurringPaymentRepository en features/*/data/api con mappers y tests. docs/backend/deudas.md.
```

---

## Pista B · Sonnet

### [ ] B-4.1 · Presupuestos (07-A)
- **Rama:** `feature/b-4.1-presupuestos` · **Depende de:** 4.0
- **Ficheros exclusivos:** `mobile/src/features/budgets/{domain/usecases,data/InMemory*,presentation}/**`, `mobile/src/features/budgets/budgets.module.ts`, `mobile/src/app/(tabs)/plan*`, `mobile/src/app/budgets/**`, `docs/features/presupuestos.md`
- **Hecho cuando:** pestaña Planificar con la entrada a Presupuestos, Deudas y Recurrentes; lista de presupuestos con barras, restante o exceso (en rojo si se supera); crear y editar presupuesto; acción "mover importe entre presupuestos"; se activa el bloque de presupuestos de Inicio; tests.
- **Prompt:**
```
Tarea B-4.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Implementa la pestaña Planificar (hub a Presupuestos / Deudas / Recurrentes) y la feature budgets (pantalla 07, maquetación A "barras"): lista con progreso, restante o exceso, crear/editar presupuesto y mover importe entre presupuestos. Activa en Inicio el bloque de presupuestos que B-3.2 dejó oculto.
Casos de uso + InMemoryBudgetRepository + budgets.module.ts. Tests. docs/features/presupuestos.md.
```

### [ ] B-4.2 · Deudas (08-B + estrategia)
- **Rama:** `feature/b-4.2-deudas` · **Depende de:** B-4.1 y **A-4.1** (motor financiero en `develop`)
- **Ficheros exclusivos:** `mobile/src/features/debts/{domain/usecases,data/InMemory*,presentation}/**`, `mobile/src/features/debts/debts.module.ts`, `mobile/src/app/debts/**`, `docs/features/deudas.md`
- **Hecho cuando:** lista de deudas con total pendiente; detalle con anillo de progreso, cuota y fecha de fin; simulador de pago extra (chips 50/100/200) calculado en el dispositivo con `@icount/finance`; sección de estrategia avalancha frente a bola de nieve; alta y edición de deudas; tests.
- **Prompt:**
```
Tarea B-4.2 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Implementa la feature debts (pantalla 08, maquetación B "detalle + simulador"): lista con total pendiente, detalle con ProgressRing, cuota y fecha de fin, simulador de pago extra (chips) calculado en el dispositivo con @icount/finance, sección de estrategia avalancha vs bola de nieve (de la maquetación C), y alta/edición de deudas.
Casos de uso + InMemoryDebtRepository + debts.module.ts. Tests. docs/features/deudas.md.
```

### [ ] B-4.3 · Pagos recurrentes
- **Rama:** `feature/b-4.3-recurrentes` · **Depende de:** B-4.2
- **Ficheros exclusivos:** `mobile/src/features/recurring/{domain/usecases,data/InMemory*,presentation}/**`, `mobile/src/features/recurring/recurring.module.ts`, `mobile/src/app/recurring/**`, `docs/features/recurrentes.md`
- **Hecho cuando:** lista y calendario de próximos vencimientos; crear un recurrente (factura, letra, suscripción) con periodicidad; recordatorio local con `expo-notifications` el día antes; tests.
- **Prompt:**
```
Tarea B-4.3 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Implementa la feature recurring: próximos vencimientos (lista + vista calendario reutilizando el componente del historial si es posible), crear/editar recurrente con periodicidad, y recordatorio local con expo-notifications el día antes (pide permiso en contexto, no al abrir la app). Casos de uso + InMemory + recurring.module.ts. Tests. docs/features/recurrentes.md.
```

---

## [ ] 4.9 · Integración y cierre — Opus, en solitario
- **Hecho cuando:** módulos en modo `api`; los números del simulador en la app coinciden con los del backend (mismo paquete); el job de recurrentes se ha probado de punta a punta; fase 4 → ✅; release `0.4.0`.
- **Prompt:**
```
Tarea 4.9 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Integra la fase 4 (Api* en los módulos budgets/debts/recurring), verifica que simulador app y backend coinciden, prueba el job de recurrentes y las notificaciones locales en el emulador, actualiza docs de estado, marca la fase 4 ✅ y publica la release 0.4.0.
```
