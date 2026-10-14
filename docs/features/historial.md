# Feature: Historial y detalle del movimiento

Tarea B-3.3 · Pantalla 06 del lienzo, maquetación **B · Calendario** ([ADR-0009](../adr/0009-direccion-visual-midnight-glass.md)) · Caché: [ADR-0014](../adr/0014-cache-persistida-y-optimistas.md)

## Qué hace
**Historial** (pestaña): un calendario del mes donde cada día se tiñe según lo gastado (un mapa de calor por cuartiles), con navegación entre meses (no se puede ir al futuro), el total de ingresos y gastos del mes y, debajo, la lista de movimientos del día elegido. Una caja de **búsqueda** y los filtros (Todo/Gastos/Ingresos y "Solo compartidos") cambian la lista a **resultados de todas las fechas**, con paginación infinita.

**Detalle** (`icount://transaction/<id>`): los datos del movimiento, con **Editar** (importe, categoría, nota, día y "compartido") y **Eliminar** con una confirmación explícita ("Esta acción no se puede deshacer").

**Analogía:** el calendario es un `LazyVerticalGrid` (Compose) / `LazyVGrid` (SwiftUI) con celdas pintadas por intensidad, como el gráfico de contribuciones de GitHub. La lista es un `LazyColumn`/`List`; FlashList es el `RecyclerView` de React Native: recicla las filas en vez de crear una por movimiento.

## Cómo está construida

```
mobile/src/features/transactions/
├── domain/
│   ├── heatmap.ts          intensityOf / intensityByDay: nivel 0–4 por cuartiles
│   ├── monthGrid.ts        buildMonthGrid (semanas lunes→domingo), shiftMonth, isFutureMonth
│   └── usecases/TransactionUseCases.ts   ListTransactions · GetTransaction · GetDailyTotals
│                                          · UpdateTransaction · DeleteTransaction
└── presentation/
    ├── history/   useHistoryViewModel · HistoryScreen (FlashList) · CalendarGrid
    └── detail/    useTransactionDetailViewModel · TransactionDetailScreen
mobile/src/app/(tabs)/history.tsx · app/transaction/[id].tsx    rutas finas
mobile/src/shared/{hooks/useDebouncedValue.ts, ui/Button (danger), testing/flashListStub.tsx}
```

## Decisiones y por qué
- **Intensidad por cuartiles de rango percentil, con empates en el medio.** Cada día con gasto se compara con los demás días *con gasto* del mes: nivel = 1 + cuartil de su percentil (donde los empates comparten el centro del grupo). Un solo día, o días que gastaron lo mismo, caen en el nivel 3 en vez de aparentar ser el más bajo o el más alto. Es monótono (gastar más nunca baja el nivel) y compara céntimos enteros.
- **Calendario con semanas de lunes a domingo y relleno**: se prueba contra meses que empiezan en lunes, en domingo, de 28/29/31 días y con seis filas. `shiftMonth` acarrea el año; el mes siguiente se desactiva en el actual.
- **Un solo mecanismo de lista**: el día seleccionado es "un filtro de fechas" (`from = to = día`) y la búsqueda es otro conjunto de filtros; ambos van por `useInfiniteQuery` con el mismo `list` del repositorio y cursor opaco. Cambiar de filtro cambia la clave de caché, así que volver al día anterior es instantáneo.
- **Búsqueda con pausa** (`useDebouncedValue`, 300 ms): se puede escribir sin lanzar una consulta por letra. El repositorio ignora mayúsculas y tildes ("cafe" encuentra "Café").
- **Tocar un día sale de la búsqueda**: quien toca el 12 quiere ver el 12.
- **FlashList en vez de `FlatList`/`map`**: el historial puede tener miles de movimientos; FlashList (v2: sin `estimatedItemSize`) recicla filas. Toda la pantalla es la lista, con el calendario y los filtros en `ListHeaderComponent`, para no anidar una lista dentro de un `ScrollView`.
- **Editar y borrar son *no* optimistas**: son raros, el usuario espera confirmación y la verdad es el servidor. Tras guardar o borrar se actualiza la caché del detalle y se **invalidan todas las listas y resúmenes** del hogar (`transactions.all`), así Inicio e Historial se refrescan solos.
- **Borrar pide confirmación dentro de la pantalla** (no `Alert` nativo): es accesible, se prueba y se ve igual en las dos plataformas. "No, conservar" es el camino fácil; el botón destructivo usa la variante `danger`.
- **El detalle no deja viajar en el tiempo**: las flechas del día no pasan de hoy; el caso de uso `UpdateTransaction` valida lo mismo (importe > 0, nota ≤ 80 caracteres, fecha no futura).
- **Un movimiento borrado o un enlace roto** se presentan como "Este movimiento ya no existe", no como una pantalla en blanco ni un error técnico.
- **Protección de rutas**: `transaction/[id]` vive dentro de la fase `ready`; un deep link sin sesión no la abre.
- **Doble de pruebas de FlashList** (`shared/testing/flashListStub`): el `jestSetup` oficial apunta a un export que FlashList 2.0.2 ya no tiene, así que se mapea a una `FlatList` que renderiza todo.

## Cómo probarlo
1. `npx expo start --port 8082` (modo memoria; cada hogar trae movimientos de ejemplo de dos meses).
2. **Historial**: toca días del calendario, cambia de mes con las flechas, busca "super" y activa "Solo compartidos".
3. Toca un movimiento → **Editar** (cambia el importe y el día con las flechas) → **Guardar cambios**; luego **Eliminar** y comprueba la confirmación.
4. Vuelve a **Inicio**: las cifras y las barras reflejan los cambios.

## Tests
- Dominio: `heatmap` (cuartiles, empates, monotonía), `monthGrid` (14 casos de calendario y navegación), los casos de uso nuevos con validaciones.
- ViewModels: historial (mes, celdas, intensidades, totales, día, meses, búsqueda/filtros, paginación, error y recuperación) y detalle (lectura, edición, validación, guardado, invalidación de listas, borrado con confirmación, fallos).
- UI: `HistoryScreen`, `TransactionDetailScreen`, `useDebouncedValue`.
- `navigation.test.tsx`: deep link a `/history`, abrir un movimiento desde el historial y volver, `/transaction/<id>` inexistente y sin sesión.
- Sin probar en dispositivo: el rendimiento de FlashList con miles de filas y el aspecto del calendario.
- **Pendiente:** conectar `ApiTransactionRepository` (3.9); el mapa de calor usa `dailyTotals` (en la API ya viene agregado); una lista optimista en el historial (hoy el movimiento nuevo aparece al refrescar tras guardar).

## Para la entrevista
"El mapa de calor colorea cada día por el cuartil de su percentil de gasto dentro del mes, con los empates compartiendo el centro del grupo para que un único día o varios iguales no se vean ni mínimos ni máximos; es una función pura sobre céntimos enteros y la probé con tablas, incluida la monotonía. La lista usa un único mecanismo —`useInfiniteQuery` con filtros— tanto para 'el día seleccionado' como para la búsqueda sobre todas las fechas, con pausa de 300 ms al escribir, y FlashList para reciclar filas. Editar y borrar no son optimistas a propósito: son poco frecuentes y quiero que el servidor sea la verdad; tras cambiarlos invalido el prefijo de caché del hogar y Inicio, Historial y los resúmenes se refrescan solos. Borrar exige una confirmación dentro de la pantalla, que es accesible y testeable."
