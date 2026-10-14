# Persistencia, caché y actualizaciones optimistas (app)

Implementación de [ADR-0014](../adr/0014-cache-persistida-y-optimistas.md): la app muestra al instante la última foto conocida (también sin red) y las altas aparecen antes de que responda el servidor. Código en `mobile/src/core/{storage,query}` y en los repositorios `features/*/data/api`.

| Pieza | Qué hace | Android |
|---|---|---|
| `core/storage/mmkvStorage.ts` | Almacén clave-valor síncrono (MMKV) | `SharedPreferences`, pero mucho más rápido |
| `core/query/persistence.ts` | Persiste y restaura la caché de TanStack Query | La caché de Room que lee un `NetworkBoundResource` |
| `core/query/queryKeys.ts` | Claves jerárquicas de caché por feature | Las claves de caché del repositorio |
| `core/query/optimistic.ts` | Mutación optimista: aplicar, revertir e invalidar | Actualizar el `StateFlow` antes de la llamada y deshacer en el `catch` |
| `ApiTransactionRepository`, `ApiCategoryRepository` | Puertos de dominio sobre la API, con *mappers* DTO ↔ dominio | Retrofit + *mappers* a entidades |

## Caché persistida
- **MMKV** guarda la caché serializada bajo `icount.query-cache.v1`. Es **síncrono**: al arrancar, la caché está disponible antes del primer *render*, sin estado intermedio de "cargando". La instancia se crea en el primer uso, así que importar el módulo no toca código nativo (tests, web).
- `createPersistOptions(storage)` devuelve las opciones de `<PersistQueryClientProvider>`, conectado en el layout raíz en la 3.9:
  - persiste **toda consulta con datos**, también si su último refresco falló (sin red, un fallo no debe borrar de disco lo que el usuario puede ver); las cargas a medias no se guardan;
  - **serialización con tipos** (`cacheSerialization.ts`): `Money`, `Date` y `Map` se guardan etiquetados y se reviven al restaurar (con JSON plano, `Money` volvía sin `format()`);
  - una consulta puede excluirse con `meta: { persist: false }`;
  - `maxAge` de 7 días: más antigua, se descarta;
  - `buster` ligado a `API_VERSION`: si cambia el contrato, la caché vieja no se reutiliza con formas antiguas;
  - las escrituras se agrupan (como mucho una por segundo).
- `clearPersistedQueryCache(storage)` **al cerrar sesión** (desde `endSession`): la caché contiene datos financieros del usuario anterior.
- Lo que se aprendió al probarlo en el emulador está en [integracion-api.md](integracion-api.md).

## Query keys
Las claves son arrays jerárquicos, y TanStack invalida **por prefijo**:

```ts
queryKeys.transactions.all('h1')                       // ['transactions', 'h1']
queryKeys.transactions.list('h1', { type: 'expense' }) // ['transactions', 'h1', 'list', { … }]
queryKeys.transactions.monthlySummary('h1', { year: 2026, month: 10 })
```

Tras dar de alta un movimiento, invalidar `transactions.all('h1')` refresca a la vez listas, resumen y totales diarios de ese hogar. Centralizarlas evita erratas como `'monthly-summary'` frente a `'monthlySummary'`.

## Mutaciones optimistas (para los ViewModels)

```ts
const queryClient = useQueryClient();
const create = useMutation(
  optimisticMutation({
    queryClient,
    mutationFn: (input: NewTransaction) => repository.create(input),
    updates: [{
      // Prefijo: TODAS las listas filtradas del hogar muestran la fila nueva.
      queryKey: queryKeys.transactions.lists(householdId),
      update: (page, input) => prependToPage(page, toOptimisticTransaction(input)),
    }],
    invalidate: [queryKeys.transactions.all(householdId)],
  }),
);

create.mutate({ id: generateUuid(), ...input }); // id del cliente: idempotente
```

Qué hace:
1. **`onMutate`**: cancela las peticiones en curso de esas claves (para que una respuesta vieja no pise el cambio), guarda una foto de cada consulta afectada y aplica `update`.
2. **`onError`**: restaura la foto. La fila desaparece y la UI muestra el error.
3. **`onSettled`**: invalida, y la verdad del servidor (repartos calculados, ids…) sustituye a la suposición optimista.

No hay reintento automático (`retry: false`): un `POST` con *timeout* pudo aplicarse. Con el **id generado en el cliente**, reintentar a mano es seguro, porque el servidor responde 200 con el mismo movimiento en vez de duplicarlo. Hay *helpers* para cachés con forma de página: `prependToPage` y `removeFromPage`.

## Repositorios de API
- **Fechas**: el contrato usa días de calendario (`YYYY-MM-DD`) y el dominio fechas locales a medianoche. Los *mappers* convierten con `getFullYear()` / `getMonth()` / `getDate()`, **nunca** con `toISOString()`, que es UTC: a las 23:30 en Madrid ya sería el día siguiente.
- **Dinero**: `{ amountMinor, currency }` ↔ `Money`.
- `findByMonth` recorre todas las páginas del mes (con `from` / `to`) para el caso de uso de resumen. El backend también expone `/summary`, y `monthlySummary()` es más barato.
- `getById` devuelve `null` en un 404: no existe o no es tuyo, y la API no distingue entre ambos.
- Errores: la conectividad se convierte en `network`; 400, 409 y 422 en `invalid`; un 404 en `not-found`.

## Para la entrevista

**En 30 segundos:** "La caché de TanStack Query se persiste en MMKV, que es síncrono: al abrir la app ves datos al instante, también sin red. Persisto solo lo que tuvo éxito y la invalido si cambia la versión del contrato o al cerrar sesión. Las altas son optimistas con un *helper* genérico: foto, aplicar, revertir si falla e invalidar al terminar. El id generado en el cliente hace que reintentar no duplique."

Preguntas probables:
- *¿Por qué invalidar si ya aplicaste el cambio?* Porque el servidor calcula cosas que el cliente no sabe (el reparto entre miembros, la fecha de alta). La suposición optimista es provisional.
- *¿Por qué cancelar las consultas en `onMutate`?* Si una petición antigua vuelve después de aplicar el cambio, sobrescribiría la caché con datos sin la fila nueva y "parpadearía".
- *¿Qué pasa si el usuario cierra la app con un alta pendiente?* Se pierde si no llegó al servidor. La cola persistida de escrituras es el offline completo que el ADR-0014 aplaza.
