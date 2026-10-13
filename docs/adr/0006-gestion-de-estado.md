# ADR-0006: Estado — TanStack Query (servidor) + Zustand (cliente) + Zod (fronteras)

- **Estado:** Aceptado
- **Fecha:** 2026-10-13

## Contexto
En una app de finanzas conviven dos tipos de estado muy distintos:
- **Estado de servidor**: movimientos, saldos, presupuestos. Vive en el backend, se cachea, se invalida, puede quedar obsoleto.
- **Estado de cliente**: tema, mes seleccionado, borrador de un gasto, onboarding completado.

## Opciones consideradas
1. **Redux Toolkit (+ RTK Query)** — muy completo, más boilerplate.
2. **TanStack Query + Zustand** — cada herramienta para su tipo de estado; mínimo boilerplate.
3. **Solo Context + useState** — sencillo, pero re-renderiza todo el árbol y no resuelve caché/reintentos.

## Decisión
- **TanStack Query v5** para todo lo asíncrono/servidor, usado *dentro* de los ViewModels.
- **Zustand v5** para estado global de cliente pequeño.
- **Zod v4** para validar datos en las fronteras (respuestas de API, formularios).

## Por qué
- TanStack Query resuelve caché, deduplicación, reintentos, refetch al volver a la app, estados `isPending/isError` y **mutaciones optimistas** (añadir un gasto y verlo al instante).
- Zustand: store mínimo, sin providers, selectores para evitar re-renders.
- Zod: el tipo TypeScript se infiere del esquema (`z.infer`) → una sola fuente de verdad.

## Consecuencias
- Los casos de uso siguen siendo la fuente de la lógica; Query solo orquesta cuándo ejecutarlos y cachea el resultado.
- Persistencia offline de la caché (`persistQueryClient` + MMKV) queda para un ADR futuro.

## Para la entrevista
- *Kotlin*: TanStack Query ≈ un Repository con `Flow` + caché + `stale-while-revalidate`; Zustand ≈ un `StateFlow` singleton en un módulo de DI.
- "Separo estado de servidor y de cliente porque tienen ciclos de vida distintos: el de servidor es una caché de algo que no me pertenece."
