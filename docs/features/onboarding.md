# Feature: Onboarding

Tarea B-2.1 · Rama: `feature/b-2.1-onboarding` · Pantalla 01 del lienzo, maquetación **B · Cifra protagonista** ([ADR-0009](../adr/0009-direccion-visual-midnight-glass.md))

## Qué hace
Tres pasos que presentan la app con una cifra enorme como protagonista: lo que te queda este mes, lo que puedes gastar hoy y tu parte cuando compartes. El usuario pasa de paso con **Siguiente** (o deslizando), puede salir con **Saltar** y en el último paso el botón pasa a **Empezar**. Al terminar se guarda `onboardingCompleted` en el dispositivo y se redirige a Inicio. Quién decide *cuándo* se muestra a un usuario nuevo es B-2.2 (protección de rutas); en esta tarea la pantalla vive en `/welcome`.

**Analogía:** el paginador es un `HorizontalPager` de Compose con `PagerState` o un `TabView(.page)` de SwiftUI; el flag persistido es un `DataStore<Preferences>` (Android) o `@AppStorage` (SwiftUI).

## Cómo está construida

```
mobile/src/features/onboarding/
├── domain/
│   ├── OnboardingStep.ts      pasos (texto + cifra como Money o porcentaje) — TS puro
│   └── stepNavigation.ts      aritmética del paginador: clampStep, isLastStep, stepFromOffset
├── data/
│   └── onboardingStore.ts     store Zustand persistido en AsyncStorage (+ hook useOnboardingStore)
└── presentation/
    ├── useOnboardingViewModel.ts   ViewModel: estado loading | active | completed, next/skip/goTo
    └── OnboardingScreen.tsx        View: paginador animado con Reanimated
mobile/src/app/(onboarding)/
├── _layout.tsx                Stack sin cabecera
└── welcome.tsx                "/welcome" → re-exporta OnboardingScreen
mobile/src/shared/testing/reanimatedStub.tsx   sustituto de Reanimated para Jest
```

Flujo: `OnboardingScreen` → `useOnboardingViewModel` → `useOnboardingStore` (Zustand) → `AsyncStorage`.

## Decisiones y por qué
- **Estado discriminado `loading | active | completed`.** `loading` existe porque AsyncStorage es asíncrono: hasta leer el flag no sabemos si hay que enseñar el intro, y pintarlo un instante para quitarlo después se vería como un parpadeo. `completed` hace que la vista se redirija; el ViewModel no conoce el router.
- **El flag es del cliente, no del servidor** (ADR-0006: Zustand para estado de cliente, TanStack Query para el de servidor). Se persiste solo `onboardingCompleted`; el `hydrated` es transitorio y se excluye con `partialize`.
- **Fallo al leer el almacenamiento no bloquea la app.** `zustand/persist` no avisa de "hidratado" si la lectura falla; sin tratamiento la pantalla se quedaría en `loading` para siempre. Se captura el error y se arranca con los valores por defecto (se enseña el intro).
- **Fábrica `createOnboardingStore(storage)` + instancia por defecto.** La fábrica recibe el almacenamiento, así que los tests usan uno en memoria (inyección por constructor, como en los casos de uso) y la app usa `AsyncStorage`.
- **Las cifras de ejemplo son `Money` en céntimos** (ADR-0007) y se formatean en el ViewModel; la vista no tiene ningún importe literal. Los valores salen de los datos de ejemplo del lienzo (1.534,75 € disponibles ≈ 85,26 € por día).
- **La lógica del paginador es pura** (`stepNavigation.ts`): redondeo de offsets a mitad de gesto, límites y listas vacías se prueban sin React.
- **Animación con Reanimated 4.** `useAnimatedScrollHandler` escribe el desplazamiento en un `SharedValue` en el hilo de UI y de él cuelgan, sin pasar por React, el parallax de la cifra (escala y opacidad) y los puntos (que se estiran a píldora). El ViewModel solo se entera cuando el gesto termina (`onMomentumScrollEnd`); cuando se pulsa **Siguiente** la vista hace `scrollTo` hacia la nueva página. Equivale a `animateScrollToPage` en Compose.
- **Ruta `/welcome` y no `index`.** `(tabs)/index` ya ocupa `/`; dos rutas iguales en grupos distintos serían ambiguas.
- **Accesibilidad:** los botones tienen rol y etiqueta, los puntos se exponen como un único `progressbar` "Paso 1 de 3", y los títulos son cabeceras.

## Cómo probarlo
1. `npx expo start --port 8082` en `mobile/` con el development build.
2. Abre `icount://welcome` (o navega a `/welcome`): desliza entre pasos, pulsa **Siguiente**, **Saltar** y **Empezar**.
3. Cierra la app del todo y vuelve a abrir `/welcome`: debe redirigir a Inicio (el flag está guardado).
4. Para volver a verlo: borra los datos de la app o llama a `onboardingStore.getState().reset()`.

## Tests
- `domain/__tests__/stepNavigation.test.ts`: límites, redondeo, NaN/Infinity, listas vacías, offsets, y que los pasos tengan texto y cifras en céntimos enteros.
- `data/__tests__/onboardingStore.test.ts`: persiste, restaura tras "reiniciar", no persiste `hydrated`, `reset`, hidratación asíncrona y fallo de lectura.
- `presentation/__tests__/useOnboardingViewModel.test.ts`: `loading`, estado inicial, formato de cifras, `next`/`skip`/`goTo` (con límites), completar y persistir, y flag ya guardado.
- `presentation/__tests__/OnboardingScreen.test.tsx`: textos, botones, "Paso x de 3", **Empezar** en el último paso, redirecciones y estado de carga.
- Limitación: Jest no tiene el runtime nativo de Reanimated, así que las pruebas usan `shared/testing/reanimatedStub` (animaciones evaluadas en su valor inicial). El gesto de deslizar y las animaciones se comprueban en dispositivo, y no se han visto todavía.

## Para la entrevista
"El onboarding sigue MVVM: el ViewModel expone un estado discriminado `loading | active | completed` y las acciones `next`, `skip` y `goTo`; no navega, la vista redirige cuando el estado es `completed`. El flag vive en un store de Zustand persistido en AsyncStorage detrás de una fábrica que recibe el almacenamiento, así que los tests lo cubren con uno en memoria. Cuidé dos casos que suelen olvidarse: el parpadeo antes de hidratar el estado (estado `loading`) y el fallo de lectura, que con `persist` dejaría la pantalla colgada. La animación corre en el hilo de UI con Reanimated: el desplazamiento es un shared value del que dependen el parallax y los puntos, sin renderizar React en cada frame."
