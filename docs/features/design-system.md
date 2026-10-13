# Feature: Design system "Midnight Glass"

Tarea B-1.1 · Rama: `feature/b-1.1-design-system` · Decisión de diseño: [ADR-0009](../adr/0009-direccion-visual-midnight-glass.md)

## Qué es
La capa de UI reutilizable de la app: tokens (`theme.ts`) + componentes de `mobile/src/shared/ui`. Las pantallas de las features **solo** componen estos componentes; no hay colores, tamaños de letra ni sombras sueltos en las vistas.

**Analogía:** es el `MaterialTheme` + el catálogo de componentes de Compose (Android), o el conjunto de `ViewModifier`/`ButtonStyle`/`Color` de un design system en SwiftUI. `theme.ts` hace de `MaterialTheme.colorScheme/typography/shapes`; `AppText` es `Text(style = MaterialTheme.typography.x)`; `GlassCard` es un `Card` con estilo propio.

## Cómo está construido

```
mobile/src/shared/ui/
├── theme.ts            tokens: colores, tipografía, fuentes Sora, radios, spacing, minTouch
├── blurTarget.tsx      Context con la ref del BlurTargetView (necesaria en Android)
├── Screen.tsx          fondo #0B0C1A + 2 resplandores radiales SVG + safe area
├── GlassCard.tsx       superficie de cristal (BlurView) con fallback semitransparente
├── AppText.tsx         variantes de theme.typography (+ tono de color)
├── Button.tsx          primary | secondary | ghost, loading, disabled
├── IconButton.tsx      botón circular solo-icono (glass | filled)
├── Chip.tsx            etiqueta / filtro seleccionable
├── SegmentedControl.tsx  selector genérico <T extends string>
├── ProgressBar.tsx · ProgressRing.tsx · Donut.tsx   progreso y gráficos con react-native-svg
├── Avatar.tsx          Avatar + AvatarStack (iniciales y color estable por nombre)
├── ListItem.tsx        fila con leading / título / subtítulo / trailing
├── Icon.tsx            7 iconos de trazo: home, list, plus, target, users, back, send
├── geometry.ts         matemática pura de los gráficos (clamp01, donutArcs) → testeable sin React
├── DesignCatalog.tsx   galería visual de todo lo anterior
└── index.ts            barrel: `import { Button, theme } from '@/shared/ui'`
mobile/src/app/
├── _layout.tsx         carga Sora y mantiene el splash hasta que está lista
└── dev/catalog.tsx     ruta /dev/catalog (redirige a "/" si no es __DEV__)
```

## Decisiones y por qué
- **Una familia de fuente por peso** (`Sora_400Regular`, `Sora_600SemiBold`, `Sora_700Bold`) en `theme.fonts`. En Android `fontWeight` se ignora con fuentes personalizadas, así que `AppText` traduce el `fontWeight` del token a la familia correcta. Equivale a declarar un `FontFamily` con varios `Font(resId, weight)` en Compose.
- **Splash hasta que carga la fuente**: `SplashScreen.preventAutoHideAsync()` en ámbito de módulo (si se llama dentro de un componente puede ser tarde) y `hideAsync()` cuando `useFonts` termina. Si la fuente falla, la app abre igualmente con la del sistema: mejor eso que dejar al usuario atrapado en el splash.
- **Cristal en Android**: `expo-blur` (SDK 57) solo desenfoca lo que está dentro de un `BlurTargetView`. `Screen` envuelve **el fondo** en uno y comparte su ref por Context; `GlassCard` lo recoge y usa `blurMethod="dimezisBlurViewSdk31Plus"` (Android 12+; en versiones anteriores expo-blur degrada solo). Fuera de un `Screen` en Android no se pinta el `BlurView` y queda la superficie `rgba(255,255,255,0.07)`: legible, sin desenfoque. En iOS el `BlurView` funciona sin target.
- **Resplandores con `RadialGradient`** (react-native-svg) usando los tokens `glowPrimary`/`glowSecondary`; el final del degradado es el mismo color con `stopOpacity=0` para evitar el halo gris de `transparent`.
- **Accesibilidad por defecto**: todos los pulsables tienen `accessibilityRole` y label; `IconButton` *exige* `accessibilityLabel`; `Button`/`IconButton`/`SegmentedControl` ≥ 44 pt de área táctil (`theme.minTouch`); `ProgressBar`/`ProgressRing` exponen `accessibilityValue` 0–100; los iconos son decorativos salvo que se les dé label; `AppText` marca como `header` las variantes `display*`.
- **Gráficos con matemática aparte** (`geometry.ts`): `donutArcs` reparte la circunferencia proporcionalmente, ignora valores ≤ 0 / `NaN` y deja un hueco entre porciones. Es lógica pura y se prueba sin renderizar. Los `value` de `Donut` son pesos proporcionales, **no importes**: los importes siguen siendo `Money` (ADR-0007) y se formatean en el ViewModel.
- **Valores fuera de rango no rompen**: `clamp01` limita progreso a 0–1 (un presupuesto excedido al 120 % se ve lleno; el texto dice la verdad).
- **Catálogo en una ruta fina**: la galería vive en `shared/ui/DesignCatalog.tsx` y `app/dev/catalog.tsx` solo la monta si `__DEV__`. En producción redirige a Inicio.

## Cómo probarlo
1. `npm install` en la raíz y `npx expo start --port 8082` en `mobile/` (pista B).
2. Abre la app con el development build y navega a `/dev/catalog` (deep link `icount:///dev/catalog` o desde la barra de rutas de Expo Dev Tools).
3. Comprueba: la fuente Sora, los dos resplandores, el cristal en las tarjetas, los estados de los botones y los gráficos.

## Tests
`mobile/src/shared/ui/__tests__/` — un fichero por componente (Testing Library para RN): render, interacción, estados deshabilitado/cargando, accesibilidad (roles, labels, valores) y casos límite (valores fuera de rango, listas vacías, `NaN`). `geometry` se prueba en `Donut.test.tsx`.

## Pendiente / notas
- Verificado con lint, typecheck y Jest. **La comprobación visual en dispositivo** (Android/iOS) no se ha hecho en esta tarea; se hace en 1.9 con el emulador (ver plan).
- La animación (Reanimated) no está en esta tarea: los componentes son estáticos. Cuando haga falta, `ProgressBar`/`ProgressRing` son los candidatos naturales.

## Para la entrevista
"Montamos un design system propio sobre tokens tipados (`as const`): ningún componente de pantalla usa un color o un tamaño literal, así que un tema claro es cambiar un objeto. Resolví tres problemas concretos de React Native: la fuente por peso en Android (una familia por peso, porque `fontWeight` se ignora con fuentes custom), el desenfoque real en Android 12+ (`BlurTargetView` + Context para que cada tarjeta encuentre su fondo, con degradación a superficie semitransparente) y el splash hasta que la fuente está lista. La accesibilidad es parte de la API: el `IconButton` no compila sin `accessibilityLabel`, las áreas táctiles son de 44 pt y los gráficos exponen su valor a los lectores de pantalla. La lógica de los gráficos está separada en funciones puras para probarla sin renderizar."
