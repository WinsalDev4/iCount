# ADR-0014: Caché persistida en MMKV y actualizaciones optimistas; offline completo aplazado

- **Estado:** Aceptado
- **Fecha:** 2026-10-14

## Contexto
En la fase 3, la app pasa a mostrar movimientos reales de la API. Requisitos de producto:
- Abrir la app y **ver datos al instante**, también sin cobertura (en el metro, en el súper).
- Añadir un gasto en **3 toques** y verlo en la lista **sin esperar** al servidor.
- Coherencia en hogares compartidos: dos personas pueden escribir a la vez.

El estado de servidor ya vive en TanStack Query ([ADR-0006](0006-gestion-de-estado.md)) y la capa de red distingue los fallos de red ([red](../architecture/red.md)).

## Opciones consideradas
1. **Solo caché en memoria** (lo que hay): cada arranque empieza vacío, y sin red no se ve nada.
2. **Caché de TanStack Query persistida en disco + mutaciones optimistas**: la última foto conocida aparece al instante y las altas se ven sin esperar, con reversión si fallan.
3. **Offline-first completo**: base de datos local como fuente de verdad (WatermelonDB, SQLite + sincronización, PowerSync, Realm), cola de escrituras y resolución de conflictos.

Almacenamiento para la caché: **AsyncStorage** (asíncrono, basado en ficheros o SQLite, lento con blobs grandes), **MMKV** (clave-valor mapeado en memoria, síncrono, muy rápido) o **expo-sqlite**.

## Decisión
**Opción 2**:
- La caché de TanStack Query se persiste en **MMKV** (`react-native-mmkv` v4, módulo Nitro compatible con la New Architecture de SDK 57) con `@tanstack/react-query-persist-client` y `@tanstack/query-sync-storage-persister`. Persisten solo las consultas en estado `success`, con un `buster` atado a la versión del contrato y un `maxAge` de 7 días.
- **Mutaciones optimistas** con un helper común (A-3.2): `onMutate` toma una foto de la caché y aplica el cambio, `onError` restaura la foto y `onSettled` invalida.
- Las altas llevan un **id generado en el cliente** (`createTransactionRequestSchema.id`). La fila optimista y la real son la misma, y un reintento no duplica el movimiento (idempotencia en el servidor).
- **Offline-first completo aplazado** (opción 3). Sin red, la app **lee** la caché; las **escrituras** fallan con un error de red claro y se revierten.

## Por qué
- Cubre lo que el usuario percibe (arranque instantáneo, altas inmediatas) con una fracción del coste.
- El offline completo exige decisiones que aún no conocemos bien:
  - quién gana cuando dos miembros editan el mismo gasto sin conexión;
  - cómo se recalculan los repartos y saldos de un hogar con escrituras atrasadas;
  - migraciones del esquema local.
  En una app de **dinero compartido** un conflicto mal resuelto es peor que pedir conexión para escribir.
- MMKV es síncrono: rehidratar la caché no añade un salto de "cargando" al arrancar, a diferencia de AsyncStorage.
- El id generado en el cliente prepara el terreno para el offline futuro: la misma petición puede reintentarse desde una cola sin duplicarse.

## Consecuencias
- Nuevas dependencias de la app: `react-native-mmkv`, `react-native-nitro-modules`, `@tanstack/react-query-persist-client`, `@tanstack/query-sync-storage-persister` y `@shopify/flash-list` (listas largas del historial). Hace falta un *development build* nuevo, porque MMKV es código nativo.
- La caché persistida puede mostrar **datos viejos** unos segundos: las pantallas deben indicar cuándo se está refrescando (`isFetching`) y nunca tratar la caché como confirmación de una escritura.
- Al **cerrar sesión** se borra la caché persistida, porque contiene datos financieros. El *store* de MMKV no está cifrado; si se guardara algo sensible además de la caché, se usaría una instancia cifrada con la clave en SecureStore.
- Cuando se aborde el offline completo, será un ADR nuevo (cola de mutaciones persistida, `onlineManager` + NetInfo, política de conflictos por campo).

## Para la entrevista
"La app persiste la caché de TanStack Query en MMKV, así que al abrirla ves la última foto conocida al instante, incluso sin red. Las altas son optimistas: aparecen en la lista antes de que responda el servidor y se revierten si falla, con un id generado en el cliente para que reintentar no duplique. Aplacé el offline-first completo a propósito: en un hogar con dinero compartido, la resolución de conflictos es un problema de producto, no solo técnico, y preferí no arriesgar la coherencia de los saldos."

Analogía Android/iOS: es la caché de **Room** que un `NetworkBoundResource` muestra mientras refresca. Las optimistas son el patrón de **actualizar el `StateFlow` antes de la llamada y deshacer en el `catch`**. MMKV nació en WeChat como alternativa rápida a `SharedPreferences`/`NSUserDefaults`.

Preguntas probables:
- *¿Por qué no AsyncStorage?* Es asíncrono y lento con blobs grandes. MMKV lee de forma síncrona al arrancar, sin un estado intermedio de "cargando".
- *¿Qué pasa si el usuario cierra la app con una alta pendiente?* Hoy se pierde si no llegó al servidor (la UI lo dejó claro con el error). La cola persistida es justo lo que aplazamos.
- *¿Cómo evitas mostrar datos de otro usuario?* El *buster* de la caché incluye la versión del contrato, y al cerrar sesión se borra la caché.
