# Fase 3 · Movimientos → release 0.3.0

**Objetivo:** el corazón de la app. Añadir un gasto o ingreso en 3 toques, ver en Inicio cuánto se puede gastar al día y navegar el historial en calendario. La caché persiste y las altas aparecen al instante (actualización optimista). Pantallas del lienzo: 05-A, 04-C y 06-B.

---

## [ ] 3.0 · Preparación — Opus, en solitario
- **Rama:** `feature/3.0-preparacion-movimientos` · **Depende de:** fase 2 ✅
- **Hecho cuando:**
  - ADR-0014 (persistencia y offline): caché de TanStack Query persistida en MMKV, mutaciones optimistas con reversión, y sincronización offline completa aplazada (motivo explicado).
  - Dependencias de la app: `react-native-mmkv`, `@tanstack/query-persist-client-core` (o el paquete que recomiende la doc actual), `@shopify/flash-list`.
  - Contratos: transacción (crear, editar, filtros de listado con cursor, resumen mensual, totales diarios para el calendario), categorías y reparto por miembro (`shares`).
  - Puertos ampliados: `TransactionRepository` (`list`, `getById`, `create`, `update`, `delete`, `monthlySummary`, `dailyTotals`) y `CategoryRepository`. Los tests existentes siguen en verde.
  - Fase 3 → 🚧.
- **Prompt:**
```
Tarea 3.0 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Prepara la fase 3 según docs/plan/fase-3-movimientos.md: ADR-0014 (caché persistida + optimistic updates; offline-first completo aplazado y por qué), instala dependencias (npx expo install; comprueba en la doc actual el paquete de persistencia de TanStack Query v5 y la compatibilidad de MMKV con la New Architecture), contratos zod de transacciones/categorías/resúmenes en packages/contracts, y amplía los puertos TransactionRepository y CategoryRepository en la app manteniendo verdes los tests existentes (actualiza InMemoryTransactionRepository solo lo justo para compilar).
Marca estados en docs/plan/README.md.
```

---

## Pista A · Opus

### [ ] A-3.1 · Backend: movimientos y categorías
- **Rama:** `feature/a-3.1-backend-movimientos` · **Depende de:** 3.0
- **Ficheros exclusivos:** `backend/**`, `docs/backend/movimientos.md`
- **Hecho cuando:** categorías por defecto (seed en español) y personalizadas por hogar; CRUD de movimientos con ámbito de hogar; reparto por miembro guardado aplicando la `SplitRule`; listado con cursor y filtros (tipo, categoría, miembro, compartido, fechas, texto); `GET` de resumen mensual y de totales diarios; índices adecuados; importes como `BIGINT` en céntimos; tests.
- **Prompt:**
```
Tarea A-3.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Implementa en el backend los módulos categories y transactions según los contratos: categorías por defecto (seed es-ES) + personalizadas por hogar, CRUD de transacciones con autorización por hogar, cálculo y persistencia de shares por miembro aplicando la SplitRule del hogar (redondeo: el céntimo sobrante va al pagador; tests de ese caso), listado con paginación por cursor y filtros, endpoints de resumen mensual y totales diarios. Importes en BIGINT (céntimos). Índices justificados.
Documenta en docs/backend/movimientos.md (por qué cursor y no offset, para la entrevista).
```

### [ ] A-3.2 · App: datos de movimientos, persistencia y optimistas
- **Rama:** `feature/a-3.2-datos-movimientos` · **Depende de:** 3.0
- **Ficheros exclusivos:** `mobile/src/features/transactions/data/api/**`, `mobile/src/features/categories/data/api/**`, `mobile/src/core/query/**`, `mobile/src/core/storage/**`, `docs/architecture/persistencia.md`
- **Hecho cuando:** `ApiTransactionRepository` y `ApiCategoryRepository` con mappers de DTO a dominio (`Money`); caché persistida en MMKV; fábrica de *query keys* y helper genérico de mutación optimista (aplicar, revertir e invalidar) listo para los ViewModels de la pista B; tests.
- **Prompt:**
```
Tarea A-3.2 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
En la app: ApiTransactionRepository y ApiCategoryRepository (mappers DTO↔dominio con Money, validación con @icount/contracts), persistencia de la caché de TanStack Query en MMKV (core/storage + core/query), una fábrica de query keys por feature y un helper genérico de mutación optimista (onMutate snapshot → apply, onError rollback, onSettled invalidate) que la pista B usará desde sus ViewModels; documenta su uso con un ejemplo.
Tests de mappers y del helper. docs/architecture/persistencia.md (analogía con Room + NetworkBoundResource).
```

---

## Pista B · Sonnet

### [ ] B-3.1 · Añadir movimiento (05-A)
- **Rama:** `feature/b-3.1-anadir` · **Depende de:** 3.0
- **Ficheros exclusivos:** `mobile/src/features/transactions/{domain/usecases,presentation/add}/**`, `mobile/src/features/transactions/data/InMemory*`, `mobile/src/app/add.tsx`, `docs/features/anadir-movimiento.md`
- **Hecho cuando:** teclado numérico propio con *haptics*; parser `parseAmountInput` en el dominio (`"12,5"` → 1250, separadores, máximo 2 decimales, entrada vacía) con tests exhaustivos; selector gasto o ingreso; chips de categoría; pagador y "compartido"; caso de uso `CreateTransaction` con validaciones; guarda y cierra el modal.
- **Prompt:**
```
Tarea B-3.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Implementa "Añadir movimiento" (pantalla 05, maquetación A "teclado propio") como modal en src/app/add.tsx: segmented gasto/ingreso, importe grande, teclado numérico propio con expo-haptics, chips de categoría, pagador + compartido, guardar.
Dominio: parseAmountInput (string es-ES → céntimos enteros; tests exhaustivos de bordes) y caso de uso CreateTransaction con validaciones. ViewModel con useMutation (si el helper optimista de A-3.2 ya está en develop, úsalo). Amplía InMemoryTransactionRepository. Tests. docs/features/anadir-movimiento.md.
```

### [ ] B-3.2 · Inicio (04-C)
- **Rama:** `feature/b-3.2-inicio` · **Depende de:** B-3.1
- **Ficheros exclusivos:** `mobile/src/features/transactions/presentation/home/**`, `mobile/src/features/transactions/domain/usecases/**`, `docs/features/inicio.md`
- **Hecho cuando:** sustituye a la pantalla de referencia; caso de uso `GetDailyAllowance` (saldo disponible / días restantes, incluido hoy; bordes: último día del mes, saldo negativo, febrero), barras de la semana, cabecera del hogar con avatares; la sección de presupuestos queda oculta hasta la fase 4; tests.
- **Prompt:**
```
Tarea B-3.2 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Rehaz Inicio (pantalla 04, maquetación C "gasto diario"): cifra de gasto diario disponible, barras de gasto de la semana, cabecera con hogar y avatares. Sustituye a la pantalla de referencia actual manteniendo su patrón MVVM.
Dominio: GetDailyAllowance (disponible / días restantes incluyendo hoy; tests de último día del mes, saldo negativo, febrero bisiesto) y GetWeeklySpending. Deja preparado, pero oculto, el bloque de presupuestos (llega en la fase 4). docs/features/inicio.md.
```

### [ ] B-3.3 · Historial (06-B) y detalle
- **Rama:** `feature/b-3.3-historial` · **Depende de:** B-3.2
- **Ficheros exclusivos:** `mobile/src/features/transactions/presentation/{history,detail}/**`, `mobile/src/app/(tabs)/history*`, `mobile/src/app/transaction/**`, `docs/features/historial.md`
- **Hecho cuando:** calendario de intensidad con navegación entre meses; lista del día seleccionado con FlashList; búsqueda y filtros; detalle con edición y borrado (con confirmación) en `transaction/[id]`; tests.
- **Prompt:**
```
Tarea B-3.3 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Implementa Historial (pantalla 06, maquetación B "calendario"): mapa de calor mensual (intensidad por totales diarios, cuartiles), navegación entre meses, lista del día con FlashList, búsqueda y filtros; y la ruta transaction/[id] con detalle, edición y borrado con confirmación.
Casos de uso necesarios contra el puerto ampliado. Tests (cálculo de intensidad incluido). docs/features/historial.md.
```

---

## [ ] 3.9 · Integración y cierre — Opus, en solitario
- **Hecho cuando:** los módulos usan la API en modo `api`; la caché sobrevive al reinicio de la app; la actualización optimista se ve al instante y se revierte si falla (probado apagando el backend); fase 3 → ✅; release `0.3.0`.
- **Prompt:**
```
Tarea 3.9 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Integra la fase 3: conecta las implementaciones Api* en los módulos para dataSource 'api', y si B no usó el helper optimista, aplícalo en sus ViewModels. Prueba en el emulador: alta optimista, rollback con el backend apagado, persistencia tras reiniciar y calendario con datos reales. Corrige, actualiza docs de estado, marca la fase 3 ✅ y publica la release 0.3.0.
```
