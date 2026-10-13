# Feature: Navegación por pestañas

Tarea B-1.2 · Rama: `feature/b-1.2-navegacion` · Depende del [design system](design-system.md)

## Qué hace
La app abre con una barra de pestañas de cristal propia: **Inicio · Historial · (+) · Planificar · Hogar**. El botón central `+` no es una pestaña: abre la ruta modal `add`. Las pantallas de Historial, Planificar, Hogar y Añadir son provisionales (usan `PlaceholderScreen`/`Screen`) y las sustituyen B-3.1, B-3.3, B-4.1 y B-5.1. La pantalla de referencia de `transactions` pasa a ser Inicio.

**Analogía:** en Android es `NavHost` + `Scaffold(bottomBar = …)` con una `BottomAppBar` propia y un `FloatingActionButton` centrado, y el modal sería un `composable` con `dialog()`. En SwiftUI, un `TabView` con barra personalizada y un `.sheet` para "Añadir". Expo Router es como Navigation Compose, pero **las rutas son los ficheros**: `src/app/(tabs)/history.tsx` → `/history`.

## Cómo está construida

```
mobile/src/app/
├── _layout.tsx            Stack raíz: registra el grupo (tabs) y el modal add
├── (tabs)/
│   ├── _layout.tsx        <Tabs tabBar={…}>: adaptador navegación → TabBar
│   ├── index.tsx          "/"          → TransactionsScreen (Inicio)
│   ├── history.tsx        "/history"   → provisional
│   ├── plan.tsx           "/plan"      → provisional
│   └── household.tsx      "/household" → provisional
└── add.tsx                "/add"       → modal provisional
mobile/src/shared/ui/
├── TabBar.tsx             barra presentacional (sin dependencia de Expo Router)
├── PlaceholderScreen.tsx  pantalla provisional con el design system
└── Screen.tsx             nueva prop `edges` (qué bordes de la zona segura se rellenan)
mobile/src/__tests__/navigation.test.tsx   recorre el árbol real de rutas
```

## Decisiones y por qué
- **`TabBar` presentacional + adaptador.** `TabBar` recibe `items`, `activeKey`, `onSelect` y `onAdd`; no sabe nada de React Navigation. El adaptador (`ConnectedTabBar` en `(tabs)/_layout.tsx`) traduce el estado del navegador a esas props y emite el evento estándar `tabPress`, así que se respeta `preventDefault`. Es la misma separación que un *stateless composable* con *state hoisting*: la barra se prueba sin navegación y el día que cambie el navegador solo cambia el adaptador.
- **`tabBar` personalizado de `Tabs` (pestañas JS) en vez de las pestañas nativas.** Las pestañas nativas del sistema no permiten un botón central que no sea pestaña ni el cristal propio del diseño. Se descartó también la API "headless" (`expo-router/ui`): para una barra con un único hueco especial el prop `tabBar` es más directo.
- **El `+` abre `/add` con `router.push` y no es una ruta de la barra.** `add` vive en el Stack raíz con `presentation: 'modal'`, fuera de `(tabs)`: sube *encima* de las pestañas (hoja en iOS, pantalla con gesto atrás en Android) y al cerrarse conserva la pestaña en la que estabas.
- **El cristal es capa de fondo, no contenedor.** `GlassCard` recorta (`overflow: hidden`) y el FAB sobresale por arriba, así que el cristal se pinta detrás (`absoluteFill`) y la fila de botones encima.
- **Zona segura repartida.** La barra se encarga del inferior; las pantallas dentro de `(tabs)` rellenan solo `top/left/right` (`Screen edges={['top','left','right']}`, `SafeAreaView edges` en Inicio). Si no, el margen inferior se duplicaría.
- **Rutas finas.** Cada fichero de `app/` solo monta una pantalla; las provisionales son el único contenido de presentación y desaparecerán con sus tareas.
- **Deep links.** El esquema `icount://` ya estaba en `app.json`; el mapa ruta ↔ URL lo genera Expo Router de los ficheros: `icount://history`, `icount://plan`, `icount://household` y `icount://add`.

## Cómo probarlo
1. `npx expo start --port 8082` en `mobile/` con el development build en el emulador.
2. Toca cada pestaña y el `+` (se abre el modal; "Cerrar" o el gesto atrás vuelven).
3. Deep link en el emulador Android: `adb shell am start -a android.intent.action.VIEW -d "icount://history"`.

## Tests
- `shared/ui/__tests__/TabBar.test.tsx`: destinos, pestaña activa, selección, `+` separado de las pestañas.
- `src/__tests__/navigation.test.tsx`: renderiza el **árbol real** de `src/app` con `renderRouter`: abre en Inicio, un deep link por pestaña, cambio de pestaña, apertura y cierre del modal `add` y deep link directo a `/add`.
- Limitación: los matchers de ruta de `expo-router/testing-library` (`toHavePathname`) no funcionan con Testing Library v14 (su `render` ahora es asíncrono y el helper lo trata como síncrono); por eso las aserciones se hacen sobre lo que ve el usuario (pestaña seleccionada y título visible).
- El deep link contra el sistema operativo real (`adb`) no se ejecutó en esta tarea; sí se cubre la resolución URL → pantalla.

## Para la entrevista
"La barra de pestañas es un componente de UI puro que recibe estado y callbacks, y un adaptador de diez líneas lo conecta con Expo Router, que es la misma idea de *state hoisting* de Compose. El botón central no es una pestaña sino una acción que abre una ruta modal en el Stack raíz, así que no rompe el estado de las pestañas. Prueba de navegación: renderizo el árbol de rutas real con `renderRouter` y compruebo deep links, cambio de pestañas y modal. Cuando una librería de test no encaja con la versión de otra (matchers de ruta con Testing Library 14) afirmo sobre lo que el usuario ve, no sobre el estado interno."
