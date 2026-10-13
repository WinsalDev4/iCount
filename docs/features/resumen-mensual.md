# Feature: Resumen mensual (slice de referencia)

Rama: `feature/project-setup` · Estado: hecho (datos en memoria, UI provisional)

## Qué hace
Muestra el balance del mes (ingresos − gastos) de una economía (`householdId`) y el gasto por categoría ordenado de mayor a menor.

Su objetivo principal es **servir de plantilla**: recorre todas las capas de la arquitectura ([ADR-0003](../adr/0003-arquitectura-clean-mvvm.md)) para copiar el patrón en cada feature nueva.

## Cómo está construida

```
mobile/src/
├── app/index.tsx                                   ruta "/" → re-exporta la pantalla
├── core/domain/Money.ts                            value object de dinero (ADR-0007)
├── core/di/container.ts                            composition root
├── core/di/DependenciesProvider.tsx                Context + useDependencies()
└── features/transactions/
    ├── domain/Transaction.ts                       entidad + tipos
    ├── domain/TransactionRepository.ts             puerto
    ├── domain/usecases/GetMonthlySummary.ts        caso de uso
    ├── data/InMemoryTransactionRepository.ts       adaptador con datos de ejemplo
    └── presentation/
        ├── useTransactionsViewModel.ts             ViewModel (TanStack Query + mapeo a UiState)
        └── TransactionsScreen.tsx                  View
```

Flujo: `TransactionsScreen` → `useTransactionsViewModel` → `useDependencies().getMonthlySummary` → `TransactionRepository.findByMonth` → `InMemoryTransactionRepository`.

## Decisiones y por qué
- **`UiState` como unión discriminada** (`loading | error | success`): TypeScript obliga a comprobar `status` antes de leer los datos, igual que un `when` exhaustivo sobre una `sealed interface`.
- **El ViewModel formatea** (`Money.format()`): la vista recibe strings listos; no conoce `Money` ni reglas de dominio.
- **`queryKey` incluye household y periodo**: cambiar de mes crea una entrada de caché distinta y volver atrás es instantáneo.
- **Rutas finas**: `src/app/index.tsx` solo re-exporta. Expo Router puede cambiar sin tocar las features.

## Tests
- `core/domain/__tests__/Money.test.ts` — aritmética exacta, divisas mezcladas, enteros.
- `features/transactions/domain/usecases/__tests__/GetMonthlySummary.test.ts` — totales, agrupación por categoría, mes vacío. El repositorio es un *fake* inyectado por constructor: no hace falta React.

## Para la entrevista
"Construí un slice vertical como referencia: entidad y puerto en dominio, caso de uso con inyección por constructor, adaptador en memoria, ViewModel como custom hook con TanStack Query que mapea a un UiState discriminado, y una vista sin lógica. Cambiar a la API real es crear `ApiTransactionRepository` y tocar una línea del composition root."
