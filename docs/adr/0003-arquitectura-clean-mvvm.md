# ADR-0003: Clean Architecture + MVVM, organizada por feature

- **Estado:** Aceptado
- **Fecha:** 2026-10-13

## Contexto
Necesitamos una arquitectura mantenible, testeable y explicable en entrevista. Vengo de Android (MVVM con ViewModel + StateFlow) e iOS (SwiftUI + ObservableObject/@Observable). En React Native, ¿MVVM o MVP?

## Opciones consideradas

### Patrón de presentación
1. **MVP** — el Presenter recibe una interfaz `View` y llama a `view.showX()`. Encaja con UI imperativa (Activities/XML, UIKit). En React chocaría: la UI es **declarativa** (`UI = f(state)`), no expones métodos para mutar la vista. Implementar MVP aquí obliga a puentear callbacks contra `setState`, más código sin beneficio.
2. **MVVM** — el ViewModel expone **estado observable + acciones**; la vista se re-renderiza cuando cambia el estado. Es exactamente el modelo mental de React, Jetpack Compose y SwiftUI.
3. **Redux/Flux global** — un store único con reducers. Útil para estado global complejo, pero excesivo como patrón por pantalla y mezcla estado de servidor con estado de UI.

### Organización de carpetas
- **Por capa** (`/components`, `/services`, `/hooks`…) — se dispersa una feature por todo el árbol.
- **Por feature** con capas dentro — cada feature es autocontenida y borrable.

## Decisión
**MVVM** en presentación + **Clean Architecture** (domain / data / presentation) **dentro de cada feature**.

```
features/transactions/
├── domain/                        ← TS puro. Cero imports de React/RN/Expo
│   ├── Transaction.ts             entidades y tipos
│   ├── TransactionRepository.ts   puerto (interfaz)
│   └── usecases/GetMonthlySummary.ts
├── data/
│   └── InMemoryTransactionRepository.ts   adaptador (luego ApiTransactionRepository)
└── presentation/
    ├── useTransactionsViewModel.ts   ViewModel = custom hook
    └── TransactionsScreen.tsx        View
```

### Cómo es un ViewModel en React
Un **custom hook** `useXxxViewModel()` que:
- obtiene casos de uso del contenedor de DI (`useDependencies()`),
- expone un `state` inmutable modelado como **unión discriminada** (`loading | error | success`) — el equivalente a una `sealed interface UiState` en Kotlin,
- expone acciones (`refresh`, `onAmountChanged`, …),
- formatea datos para la vista (la vista no sabe qué es `Money`).

### Inyección de dependencias
DI **manual** con un *composition root* (`core/di/container.ts`) expuesto vía React Context (`DependenciesProvider`). Es el único fichero que hace `new` de implementaciones concretas.
Descartado `tsyringe`/`inversify`: requieren decoradores y `reflect-metadata`, añaden magia y peso en Hermes para un beneficio que aquí no necesitamos. En tests se inyecta un contenedor falso: `<DependenciesProvider container={fake}>`.

## Por qué
- MVVM es el patrón natural de una UI declarativa; MVP es de UIs imperativas.
- La regla de dependencias (`presentation → domain ← data`) permite testear casos de uso sin React y cambiar la fuente de datos (memoria → API → caché offline) sin tocar dominio ni UI.
- Organizar por feature escala y permite trabajar en ramas `feature/*` tocando una sola carpeta.

## Consecuencias
- Más ficheros que un "todo en el componente". Para pantallas triviales se permite omitir el caso de uso si sería un simple pass-through (pragmatismo > ceremonia).
- El estado de servidor lo gestiona TanStack Query dentro del ViewModel ([ADR-0006](0006-gestion-de-estado.md)).

## Equivalencias con lo que ya conoces

| Android (Kotlin) | iOS (SwiftUI) | iCount (React Native) |
|---|---|---|
| `ViewModel` + `StateFlow<UiState>` | `@Observable class ViewModel` | `useXxxViewModel()` → `{ state, actions }` |
| `sealed interface UiState` | `enum State` con associated values | unión discriminada `{ status: 'loading' } \| …` |
| `@Composable fun Screen(vm)` | `struct Screen: View` | `function Screen()` (componente) |
| Hilt / Koin module | Factory / Resolver | `core/di/container.ts` + Context |
| UseCase con `operator fun invoke` | UseCase struct | clase con `execute()` |
| Repository interface en `domain` | Protocol | `interface TransactionRepository` |

## Para la entrevista
"Uso MVVM porque React es declarativo: la vista es función del estado, igual que Compose o SwiftUI. El ViewModel es un custom hook que expone estado inmutable como unión discriminada y acciones; la vista no contiene lógica. Por debajo, Clean Architecture por feature: el dominio es TypeScript puro con puertos, la capa de datos implementa adaptadores, y un composition root manual inyecta dependencias vía Context. Así testeo casos de uso con Jest sin renderizar nada y puedo cambiar de mock a API real tocando un solo fichero."

Preguntas típicas:
- *¿Por qué no MVP?* — ver arriba: UI declarativa.
- *¿El hook no acopla el ViewModel a React?* — Sí, a propósito: el ViewModel pertenece a presentación. El dominio, que es lo valioso, está desacoplado.
- *¿Cómo testeas un ViewModel?* — `renderHook` de Testing Library envolviendo con un `DependenciesProvider` falso y un `QueryClientProvider`.
