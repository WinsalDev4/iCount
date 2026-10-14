# Feature: Configuración del hogar (crear, invitar, unirse, repartir)

Tarea B-2.3 · Pantalla 03 del lienzo, maquetación **A · Opciones desplegables** ([ADR-0009](../adr/0009-direccion-visual-midnight-glass.md)) · Depende de [acceso](acceso.md)

## Qué hace
Tras iniciar sesión por primera vez, quien no tiene hogar elige cómo va a usar iCount:
- **Solo yo**: un hogar personal con el nombre que quiera. Un toque más y entra en la app.
- **Compartida**: un hogar para pareja, familia o piso. Se crea, se **comparte un código de invitación** (hoja de compartir del sistema) y se elige la **regla de reparto** viendo cuánto pagaría cada persona por un gasto de 100 €.
- **Tengo un código**: se une al hogar de otra persona escribiendo el código (acepta `abcd-2345`, `ABCD 2345`…).

**Analogía:** es el "onboarding de workspace" de Slack/Notion: crear o unirse. La hoja de compartir es `Intent.ACTION_SEND` en Android y `UIActivityViewController` en iOS; React Native lo envuelve en `Share.share`. El reparto con vista previa es un *calculator* de Splitwise.

## Cómo está construida

```
mobile/src/features/household/
├── domain/
│   ├── allocate.ts           reparte céntimos por pesos y SIEMPRE suma el total (mayor resto)
│   ├── previewSplit.ts       "¿qué paga cada uno por este gasto?" para cada tipo de regla
│   ├── inviteCode.ts         normaliza / valida / formatea el código de 8 caracteres
│   ├── householdName.ts      1–60 caracteres, espacios colapsados
│   └── usecases/             GetMyHouseholds · CreateHousehold · CreateInvite · JoinHousehold
│                             · SetSplitRule · SetMyIncome
├── data/
│   ├── InMemoryHouseholdRepository.ts   modo memoria (códigos mágicos para probar errores)
│   └── setupStore.ts                    "hay un alta en curso" (Zustand, no persistido)
├── presentation/
│   ├── households.ts                    la lista de hogares como query + upsert en caché
│   ├── use{ChooseSetup,Invite,SplitRule}ViewModel.ts
│   └── {ChooseHousehold,Invite,SplitRule}Screen.tsx
├── testing/householdTestKit.tsx
└── household.module.ts                  repositorio + casos de uso
mobile/src/app/(setup)/choose · invite · split      las tres pantallas del flujo
mobile/src/shared/ui/{ExpandableCard,OptionCard}.tsx
mobile/src/shared/format/parseAmountInput.ts        texto es-ES → Money (céntimos, sin floats)
```

### Integración con la protección de rutas
La fase de acceso gana un paso: `… → offer-biometrics → **setup** → ready`. Un usuario con sesión y **sin hogares** cae en `(setup)`; en cuanto tiene uno, el router lo saca solo hacia la app. Para el hogar compartido hay una excepción: el hogar ya existe al terminar el primer paso, pero faltan invitar y repartir. `setupStore.pendingHouseholdId` mantiene la fase en `setup` hasta que se guarda la regla o se pulsa "Más tarde".

## Decisiones y por qué
- **Reparto en céntimos enteros con el método del mayor resto** (`allocate`). 100,00 € entre tres es 33,34 + 33,33 + 33,33, nunca 99,99 €. Los pesos nunca pasan por decimales de dinero (ADR-0007). Hay un test que recorre cientos de totales y pesos comprobando que la suma siempre cuadra.
- **La vista previa y la regla real son la misma lógica** (`previewSplit` aplica `equal`, `income-proportional` y `custom` como define `SplitRule`). Si falta el ingreso de alguien, la regla proporcional **no inventa nada**: muestra partes iguales y lo explica en una nota.
- **"A medida" solo con dos miembros.** Una regla personalizada necesita una parte por miembro que sume el 100 %; al crear el hogar solo está quien lo crea. Se deja deshabilitada con el motivo ("Disponible cuando se una la otra persona") en lugar de ofrecer algo que el servidor rechazaría. La interfaz usa un único control (± 5 %) aplicado a todas las categorías de gasto; el modelo de datos ya admite porcentajes por categoría.
- **Un error de red no te devuelve al alta.** La fase `setup` exige que la lista de hogares haya *respondido* vacía; si no se pudo leer (sin conexión) se abre la app en vez de empujar a un usuario existente a crear otro hogar.
- **El código se valida antes de enviarlo** (`JoinHousehold`) y el servidor sigue teniendo la última palabra: caducado, desconocido, ya eres miembro.
- **`parseAmountInput` vive en `shared/format`** porque lo reutilizarán "Añadir movimiento" (B-3.1) y los presupuestos. Reglas: `,` decimal, `.` miles (`1.234` = 1234; `12.5` = 12,50), como mucho 2 decimales, sin signos. Tests exhaustivos de bordes.
- **Modo memoria sin backend:** cualquier código bien formado te une a un hogar de ejemplo ("Casa Ana & Leo"); `EXPIRED1` y `UNKNOWN1` fuerzan los dos errores para ver los mensajes.
- **La vista no tiene lógica**: crear, unirse, invitar y guardar se deciden en los ViewModels; las pantallas solo navegan al siguiente paso cuando el ViewModel lo indica.

## Cómo probarlo
1. `npx expo start --port 8082` (modo memoria). Inicia sesión como en [acceso](acceso.md).
2. **Solo yo** → *Crear* → Inicio.
3. Cierra sesión (Hogar → Cuenta) y entra de nuevo: el modo memoria olvida el hogar, así que vuelve el alta. **Compartida** → nombre → *Crear e invitar* → *Compartir código* → *Continuar* → elige *Según ingresos*, escribe `1.850` y `2.000` y mira cómo cambia el reparto → *Guardar y empezar*.
4. **Tengo un código** → `ABCD-2345` (entra), `EXPIRED1` (caducado), `UNKNOWN1` (no válido).

## Tests
- Dominio: `allocate` (suma siempre exacta), `previewSplit` (tres reglas y sus casos límite), código y nombre, casos de uso con el repositorio en memoria, parseo de importes (47 casos).
- Datos: `InMemoryHouseholdRepository` (administración, caducidad a 48 h, alfabeto sin caracteres ambiguos, reglas personalizadas).
- ViewModels: los tres, con el kit de pruebas (estados, errores, caché, fin del alta).
- UI: `ExpandableCard`, `OptionCard`.
- `src/__tests__/navigation.test.tsx` recorre las rutas reales: sin hogar → alta (también desde un deep link), personal, unirse con código, código caducado, compartido completo (crear → invitar → repartir → app) y "Más tarde".
- Sin probar en dispositivo: la hoja de compartir del sistema (`Share.share`) y el teclado numérico.
- **Pendiente de 2.9:** `ApiHouseholdRepository` cuando `dataSource === 'api'`; que el reparto "a medida" por categoría tenga su propia pantalla (hoy un único porcentaje); y el cambio de hogar activo si el usuario tiene varios.

## Para la entrevista
"Reparto el dinero en céntimos enteros con el método del mayor resto, así que las partes siempre suman el gasto: cien euros entre tres son 33,34, 33,33 y 33,33. Lo comprobé con un test que recorre cientos de combinaciones. La vista previa del reparto usa exactamente la misma función que las reglas reales, y si falta un dato (los ingresos de la otra persona) no lo inventa: cae a partes iguales y lo dice. El alta es parte de la protección de rutas: una fase `setup` entre 'sesión iniciada' y 'app', con una excepción para el hogar compartido, que existe antes de estar configurado; un pequeño store en memoria mantiene al usuario dentro hasta que termina. Y un detalle de robustez: si la lista de hogares no se puede leer por falta de red, no se manda a un usuario existente a crear otro."
