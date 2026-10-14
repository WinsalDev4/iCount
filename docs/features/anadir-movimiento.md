# Feature: Añadir movimiento

Tarea B-3.1 · Pantalla 05 del lienzo, maquetación **A · Teclado propio** ([ADR-0009](../adr/0009-direccion-visual-midnight-glass.md)) · Caché y optimistas: [ADR-0014](../adr/0014-persistencia-cache-y-optimistas.md)

## Qué hace
El botón `+` de la barra abre un modal para registrar un gasto o un ingreso en **tres toques y un guardar**: el importe se teclea en un teclado numérico propio (con un toque háptico por tecla), se elige la categoría con chips, "Hoy"/"Ayer" para la fecha y, en un hogar compartido con más gente, quién pagó y si el movimiento es **compartido**. Al guardar, el movimiento aparece **al instante** arriba de las listas y el modal se cierra; si el servidor lo rechaza, desaparece y se explica el motivo.

**Analogía:** el teclado es un *calculator ViewModel* con un *reducer* de pulsaciones (Compose: un `NumberPad` con estado elevado; SwiftUI: un `LazyVGrid` de botones sobre un `@State`). La actualización optimista es escribir en el `StateFlow` antes de llamar a la API y revertir en el `catch`.

## Cómo está construida

```
mobile/src/features/transactions/
├── domain/
│   ├── keypad.ts                applyKey / displayAmount / isPositiveAmountText (reducer puro)
│   ├── summarize.ts             summarizeTransactions + totalsByDay (resumen del mes y por día)
│   └── usecases/CreateTransaction.ts   valida, genera el id en el cliente, toOptimisticTransaction
├── data/InMemoryTransactionRepository.ts   TODO el puerto: list (filtros + cursor), getById,
│                                           create (idempotente), update, delete, resúmenes
├── presentation/add/
│   ├── useAddTransactionViewModel.ts    estado, teclado, categorías, pagador, guardado optimista
│   ├── AddTransactionScreen.tsx         la vista
│   └── transactionMessages.ts           errores en español
├── testing/transactionsTestKit.tsx
└── transactions.module.ts               + createTransaction y el repositorio
mobile/src/features/categories/          InMemoryCategoryRepository, ListCategories, useCategories
mobile/src/features/auth/data/memoryIdentity.ts   "quién soy" para los repositorios en memoria
mobile/src/shared/{format/parseAmountInput,haptics,ui/NumericKeypad}
mobile/src/app/add.tsx                   ruta modal (re-exporta la pantalla)
```

## Decisiones y por qué
- **El importe se teclea como TEXTO** (`"12,5"`) y solo al final pasa a `Money` con `parseAmountInput` (sin floats). Así `12,` o `0,0` son estados válidos a medias y no hay redondeos. `applyKey` es una función pura: no admite dos comas, limita a 2 decimales y 7 cifras enteras, no deja ceros a la izquierda (`05` → `5`) y `,` primero da `0,`. Es el 100 % de la lógica del teclado, probada con tablas.
- **El teclado propio** (no el del sistema) deja a la vista el importe, las categorías y el botón; evita que el teclado nativo tape media pantalla. Cada tecla da un toque háptico con `expo-haptics`, envuelto en `shared/haptics.ts` para que un móvil sin motor, la web o un permiso revocado **nunca rompan** la pantalla.
- **Actualización optimista con el ayudante de A-3.2** (`optimisticMutation`): se cancela lo que esté cargando, se guarda una foto de las listas, se antepone el movimiento y, si falla, se restaura; al terminar se invalida para que mande la verdad del servidor. El id lo genera el cliente: reintentar tras un *timeout* no duplica el movimiento (el repositorio en memoria también es idempotente por id).
- **El modal se cierra cuando el guardado termina bien**, no antes: con la API real la espera es corta y, si falla, el usuario sigue delante de lo que tecleó con el mensaje del error.
- **Las categorías dependen del tipo.** Pasar a "Ingreso" cambia los chips (Nómina, Otros); la elección anterior se recuerda y vuelve si regresas a "Gasto".
- **Pagador y "Compartido" solo cuando tienen sentido:** hogar compartido con al menos dos miembros. Un hogar personal, o compartido con una sola persona, no muestra esos controles (y el movimiento nunca se marca compartido). Las partes (`shares`) las calcula el servidor con la regla del hogar; el movimiento optimista sale sin ellas.
- **Validaciones en el caso de uso** (`CreateTransaction.prepare`): importe > 0, categoría presente, nota ≤ 80 caracteres, fecha no futura. El botón "Guardar" ya está desactivado con importe cero, así que estos errores son una red de seguridad que además protege a otros llamadores.
- **El repositorio en memoria implementa el puerto entero** (no solo `create`), con las reglas de la API: lista del más nuevo al más viejo con empate por id, filtros por tipo/categoría/miembro/compartido/rango/texto (sin distinguir mayúsculas ni tildes: "cafe" encuentra "Café"), paginación por cursor opaco y resúmenes. Así Inicio e Historial (B-3.2, B-3.3) se construyen sobre él. Cada hogar recibe datos de ejemplo la primera vez que se consulta, nunca con fechas futuras.
- **"Quién soy" en modo memoria** (`memoryIdentity`): el repositorio de autenticación en memoria publica el usuario al verificar el enlace y los repositorios de hogar y movimientos lo leen. Con la API esto no se usa: el servidor sabe quién llama.
- **`parseAmountInput` vive en `shared/format`** (lo creó B-2.3 para los ingresos) y lo reutilizan el teclado y, más adelante, los presupuestos.

## Cómo probarlo
1. `npx expo start --port 8082` (modo memoria) y entra a la app.
2. Toca `+`: teclea `12,5`, elige una categoría, pulsa **Guardar**. Vuelve a abrirlo y prueba **Ingreso**, **Ayer** y la nota.
3. En un hogar compartido con dos miembros (usa el código `ABCD-2345` al unirte) aparecen "Lo pagó" y "Compartido".
4. Comprueba el teclado: `,` primero, tres decimales, `05`, borrar.

## Tests
- Dominio: `keypad` (tabla de pulsaciones), `summarize`, `CreateTransaction` (validaciones, idempotencia, optimista).
- Datos: `InMemoryTransactionRepository` (datos de ejemplo, listas, filtros, cursor, CRUD, resúmenes) y categorías.
- ViewModel: estados, teclas, tipo/categorías, guardado, **la lista se actualiza antes de que responda el servidor y se revierte si falla**, pagador y compartido.
- UI: `NumericKeypad` (incluida la falla del motor háptico) y `haptics`.
- `src/__tests__/navigation.test.tsx`: abrir el modal con `+`, teclear `12,5`, guardar y que se cierre.
- Sin probar en dispositivo: la sensación de las vibraciones y el teclado con una mano.
- **Pendiente:** `ApiTransactionRepository` en el contenedor (3.9); el selector de fecha libre (hoy solo Hoy/Ayer).

## Para la entrevista
"El importe se teclea como texto y solo se convierte a `Money` al final, de modo que `12,` y `0,0` son estados intermedios válidos y ningún float representa dinero. La lógica del teclado es un reducer puro con una tabla de pruebas. Guardar es optimista: el movimiento aparece arriba de la lista antes de que responda el servidor, el id lo genera el cliente para que un reintento no duplique, y si el servidor lo rechaza se restaura la foto previa de la caché. Lo probé con una prueba que congela la respuesta del servidor y comprueba el estado intermedio. Para que Inicio e Historial se construyan sobre él, el repositorio en memoria implementa el puerto completo con las mismas reglas que la API: filtros, paginación por cursor y resúmenes."
