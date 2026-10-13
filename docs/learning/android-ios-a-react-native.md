# De Android / iOS a React Native

Chuleta de equivalencias para trasladar lo que ya sabes de Kotlin/Compose y SwiftUI.

## Modelo mental

| Concepto | Jetpack Compose | SwiftUI | React Native |
|---|---|---|---|
| Unidad de UI | `@Composable fun` | `struct: View` | componente `function X(props)` |
| Estado local | `remember { mutableStateOf() }` | `@State` | `useState` |
| Estado derivado | `derivedStateOf` | computed property | `useMemo` |
| Efecto secundario | `LaunchedEffect(key)` | `.task(id:)` / `.onAppear` | `useEffect(fn, [deps])` |
| Pasar dependencias por el árbol | `CompositionLocal` | `@Environment` | `Context` + `useContext` |
| Lista eficiente | `LazyColumn` | `List` / `LazyVStack` | `FlatList` (o FlashList) |
| Layout | `Row` / `Column` / `Box` | `HStack` / `VStack` / `ZStack` | `View` + Flexbox (`flexDirection`) |
| Modificadores | `Modifier.padding()` | `.padding()` | prop `style` (`StyleSheet.create`) |
| Navegación | Navigation Compose | `NavigationStack` | Expo Router (rutas = ficheros) |
| Recomposición | recomposición por estado | invalidación del body | re-render por cambio de estado/props |
| Corrutinas / async | `suspend` + `Flow` | `async/await` + `AsyncSequence` | `async/await` + `Promise` |
| `sealed interface` | `sealed interface` | `enum` con valores | unión discriminada de tipos |
| `data class` | `data class` | `struct` | `interface` / `type` + objetos inmutables |

## Reglas de los hooks (las que más muerden al venir de nativo)
1. Solo se llaman en el nivel superior de un componente o de otro hook. Nunca dentro de `if`, bucles o callbacks. (React identifica cada hook por su **orden** de llamada.)
2. Las dependencias de `useEffect`/`useMemo` deben incluir todo lo que usas dentro; si no, ves valores "congelados" (*stale closures*).
3. Un componente se re-ejecuta entero en cada render: crear objetos/funciones en el cuerpo es normal; memoiza solo cuando se demuestre que hace falta (o deja que el React Compiler lo haga).

## Cómo se ejecuta
- Tu código TS se compila con Babel y Metro lo empaqueta en un bundle JS.
- **Hermes** (motor JS de Meta) ejecuta el bundle; compila a bytecode en la build de release.
- Con la **New Architecture**, JS habla con nativo vía **JSI** (referencias C++ directas, sin serializar JSON), **Fabric** renderiza vistas nativas reales y **TurboModules** carga módulos nativos bajo demanda.
- Los componentes de RN **no son WebViews**: `<View>` es un `android.view.ViewGroup` / `UIView`.

## Preguntas típicas de entrevista
- ¿Diferencia entre `useMemo` y `useCallback`? → memoizan un valor vs una función.
- ¿Por qué `key` en listas? → identidad estable para reconciliar elementos sin re-crearlos.
- ¿Qué causa un re-render? → cambio de estado propio, de props, o de un Context consumido; y el re-render del padre.
- ¿Cómo optimizas una lista larga? → `FlatList`/FlashList, `keyExtractor` estable, items memoizados, `getItemLayout` si la altura es fija.
- ¿Animaciones a 60/120 fps? → Reanimated: los *worklets* corren en el hilo de UI, no en el de JS.
