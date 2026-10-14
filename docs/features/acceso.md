# Feature: Acceso sin contraseña y protección de rutas

Tarea B-2.2 · Pantalla 02 del lienzo, maquetación **C · Sin contraseña** ([ADR-0009](../adr/0009-direccion-visual-midnight-glass.md)) · Autenticación: [ADR-0013](../adr/0013-autenticacion-sin-contrasena.md)

## Qué hace
1. El usuario escribe su correo → recibe un enlace de un solo uso → al abrirlo (`icount://auth/verify?token=…`) entra.
2. La primera vez, en un dispositivo con huella o cara, se le ofrece **una sola vez** el desbloqueo biométrico.
3. Con el desbloqueo activado, cada arranque en frío pide la huella o la cara antes de enseñar nada.
4. Las rutas están protegidas: **onboarding → acceso → (bloqueo) → (oferta biométrica) → app**. Nadie ve una pantalla que no le toca, ni siquiera abriendo un deep link.

**Analogía:** el enlace mágico es el flujo de "iniciar sesión con enlace por correo" de Firebase Auth. La biometría es `BiometricPrompt` (Android) / `LAContext` (iOS) protegiendo una sesión ya guardada. Las rutas protegidas son un *navigation graph* condicional: en Compose, `if (session == null) AuthGraph() else MainGraph()` dentro del `NavHost`; en SwiftUI, el `switch` raíz que elige qué vista mostrar.

## Cómo está construida

```
mobile/src/features/auth/
├── domain/
│   ├── email.ts                    normalizeEmail / isValidEmail (permisivo a propósito)
│   ├── accessGate.ts               resolveAccess(): UNA función pura decide la "fase" de acceso
│   └── usecases/                   RequestMagicLink · VerifyMagicLink · SignOut · GetSession
├── data/
│   ├── InMemoryAuthRepository.ts   acepta cualquier token (modo memoria)
│   ├── authPreferencesStore.ts     Zustand persistido: biometricsEnabled, biometricsPrompted
│   └── accessStore.ts              Zustand NO persistido: ¿desbloqueado en esta ejecución?
├── presentation/
│   ├── session.ts                  sesión como query + startSession / endSession
│   ├── useAccess.ts                junta onboarding + sesión + biometría → fase
│   ├── use{SignIn,CheckEmail,Verify,Biometrics,Lock,Account}ViewModel.ts
│   └── {SignIn,CheckEmail,Verify,EnableBiometrics,Locked}Screen.tsx · AccountCard.tsx
├── testing/authTestKit.tsx         contenedor + QueryClient de usar y tirar para los tests
└── auth.module.ts                  repositorio en memoria + casos de uso + biometría
mobile/src/app/
├── _layout.tsx                     Stack con <Stack.Protected> según la fase
├── (auth)/sign-in · check-email    pantallas de acceso
├── (locked)/locked                 bloqueo biométrico
├── auth/verify                     deep link del enlace mágico
└── enable-biometrics               oferta de un solo uso
mobile/src/shared/{ui/TextField,ui/SwitchRow,state/persistedStore.ts}
```

### Las fases de acceso

```
loading ─▶ onboarding ─▶ signed-out ─▶ locked ─▶ offer-biometrics ─▶ ready
  (lee)    (no lo vio)   (sin sesión)  (cold start    (una vez,         (app)
                                        + biometría)    si hay sensor)
```

`resolveAccess()` es una función pura sobre cinco booleanos y se prueba exhaustivamente. El layout raíz solo traduce la fase a `Stack.Protected guard={phase === '…'}`; **cuando una guarda pasa a falso, Expo Router saca al usuario de ese grupo él solo**. Por eso ninguna pantalla se redirige "por si acaso".

## Decisiones y por qué
- **La fase es un valor derivado, no un estado.** Se calcula de lo que ya existe (flag de onboarding, sesión, preferencias, desbloqueo). No hay un "estado de la app" que pueda desincronizarse.
- **La sesión es una query de TanStack** (`['session']`, `staleTime: Infinity`, `meta.persist: false` para que no se escriba en el disco con el correo). Iniciar sesión es `setQueryData`; cerrarla es `queryClient.clear()` + `null`: la caché del usuario anterior (sus datos financieros) no puede sobrevivirle.
- **`startSession` cancela primero la lectura en curso.** Con un arranque en frío desde el deep link, la lectura del almacén ("no hay sesión") puede terminar *después* de verificar el enlace y pisar la sesión nueva. Hay un test que lo reproduce.
- **El deep link vive dentro de la guarda `signed-out`.** Al guardar la sesión, la fase cambia y el router abandona la ruta solo. La primera versión navegaba a mano con `<Redirect>` y fallaba: el `Redirect` se ejecutaba antes de que el router abriera el grupo recién desprotegido (con un retardo de 50 ms funcionaba, que es la señal de una carrera). Mover la decisión a las guardas elimina la carrera sin temporizadores. Si el enlace se abre con la sesión ya iniciada, simplemente se ignora.
- **Un enlace sin token falla en local** (`VerifyMagicLink` lo rechaza sin llamar al repositorio) y la pantalla lo explica en vez de quedarse cargando. Un `useRef` evita gastar dos veces un token de un solo uso con el doble efecto de Strict Mode.
- **Biometría = candado local** (ADR-0013). Activarla exige superar la comprobación una vez, para que un interruptor que no puede funcionar no quede encendido. Si la biometría falla, siempre hay salida: **Cerrar sesión** en la pantalla de bloqueo.
- **Oferta única.** La fase `offer-biometrics` solo existe mientras el dispositivo tenga sensor *y* no se haya respondido (`biometricsPrompted`). Responder cualquiera de los dos botones cambia la fase y el router sigue.
- **Estado local persistido con helper compartido** (`shared/state/persistedStore.ts`): AsyncStorage es asíncrono y `zustand/persist` no avisa de "hidratado" si la lectura falla; el helper garantiza que la app abre con los valores por defecto en lugar de quedarse en el splash.
- **Mensajes de error en español y sin filtrar detalles técnicos** (`authErrorMessage`): un error inesperado siempre da el mensaje genérico.
- **Modo memoria utilizable sin backend:** el repositorio en memoria acepta cualquier token y, en `__DEV__`, "Revisa tu correo" ofrece **Simular que abro el enlace**.

## Cómo probarlo
1. `npx expo start --port 8082` en `mobile/` (modo memoria por defecto).
2. Primera vez: onboarding → correo → "Revisa tu correo" → *Simular que abro el enlace* → (oferta biométrica si el emulador tiene huella configurada) → Inicio.
3. Pestaña **Hogar**: tarjeta de cuenta con el interruptor biométrico y *Cerrar sesión*.
4. Activa la biometría, cierra la app del todo y ábrela: pantalla de bloqueo.
5. Deep link: `adb shell am start -a android.intent.action.VIEW -d "icount://auth/verify?token=prueba"` con la sesión cerrada.

## Tests
- Dominio: `email`, `accessGate` (todas las transiciones), casos de uso con repositorio espía, repositorio en memoria.
- Datos: `authPreferencesStore` (persistencia, reinicio, lectura fallida) y `shared/state/persistedStore`.
- ViewModels (con `authTestKit`): `SignIn`, `CheckEmail` (cuenta atrás con temporizadores falsos), `Verify` (incluida la lectura obsoleta), `Biometrics`, `Lock`, `Account`.
- `src/__tests__/navigation.test.tsx` renderiza el **árbol de rutas real** con la lógica de acceso real: primera vez, deep links bloqueados según fase, bloqueo biométrico, flujo completo correo → enlace → app, oferta biométrica, enlace sin token, cerrar sesión.
- Limitaciones: el pager del onboarding se sustituye por un componente mínimo en ese test (`expo-router/testing-library` registra un mock vacío de Reanimated); la biometría real y el esquema `icount://` del sistema operativo no se han probado en dispositivo.
- **Pendiente de 2.9:** elegir `ApiAuthRepository` cuando `dataSource === 'api'`, conectar `AuthSession.onSessionExpired` a `endSession` y limpiar la caché persistida (`clearPersistedQueryCache`) al cerrar sesión.

## Para la entrevista
"El acceso se decide con una función pura que recibe cinco booleanos y devuelve una fase (`onboarding`, `signed-out`, `locked`, `offer-biometrics`, `ready`). El layout raíz solo la traduce a `Stack.Protected` y el router mueve al usuario cuando cambia, así que ninguna pantalla contiene lógica de redirección. Me encontré una carrera real: tras verificar el enlace, la navegación manual se ejecutaba antes de que el router abriera el grupo desprotegido; la solución no fue un retardo sino mover la decisión a la propia guarda. Otra: en un arranque en frío desde el enlace, la lectura inicial de la sesión podía terminar tarde y borrar el inicio de sesión; `startSession` cancela esa lectura antes de escribir. La biometría es un candado local, nunca un factor del servidor, y se activa solo si el usuario la supera una vez."
