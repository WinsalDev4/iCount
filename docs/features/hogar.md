# Feature: Hogar (balance, actividad y miembros)

Tarea B-5.1 · Pantalla 09 del lienzo, maquetación **C · Actividad con aprobaciones**, con la cabecera de balance de la **A** ([ADR-0009](../adr/0009-direccion-visual-midnight-glass.md)) · Reglas: [ADR-0016](../adr/0016-balances-y-liquidaciones.md)

## Qué hace

La pestaña **Hogar**, de arriba abajo:

- **Balance**: "Debes 30,63 €" / "Te deben 12 €" / "Estás al día", con una línea por transferencia sugerida ("Tú debes 30,63 € a Ana", "Ana te debe…") y el aviso "Hay 2 gastos por revisar que aún no cuentan". El botón **Saldar cuentas** abre `/settle` (lo construye B-5.2).
- **Actividad**: el feed del hogar, más reciente primero, con un filtro **Todo / Por revisar (n)**. En los gastos compartidos que ha pagado otra persona y esperan mi decisión: **Aprobar** o **Rechazar** (el motivo es obligatorio). Cada movimiento se puede **comentar** en el sitio. Tocar una fila abre el detalle del movimiento. Paginación con "Ver más".
- **Miembros**: quién está (rol, ingresos declarados), la **regla de reparto** en una frase, e **Invitar a alguien**: genera el código (`ABCD-2345`) y lo comparte con la hoja del sistema.
- La tarjeta de cuenta (sesión y biometría) sigue al final.
- Un hogar de **una sola persona** no tiene balance ni aprobaciones: muestra una invitación a añadir a alguien.

**Analogía:** el balance es la cabecera de Splitwise / Tricount; las aprobaciones, el "pending" de una transferencia que tiene que confirmar la otra parte. La pestaña es un `Fragment`/`TabView` que compone tres secciones independientes, cada una con su ViewModel.

## Cómo está construida

```
features/
├── settlements/
│   ├── domain/balance.ts                computeBalance(): paid − owed por miembro + transferencias (@icount/finance)
│   ├── domain/usecases/                 GetBalance · ListSettlements · CreateSettlement
│   ├── data/InMemorySettlementRepository.ts
│   └── presentation/                    useBalanceViewModel · BalanceCard
├── activity/
│   ├── domain/usecases/                 ListActivity · DecideApproval · ListComments · AddComment
│   ├── data/InMemoryActivityRepository.ts
│   └── presentation/                    useActivityViewModel · ActivityFeed · HouseholdScreen · activityText
└── household/
    ├── data/InMemoryHouseholdLedger.ts  aprobaciones, comentarios y liquidaciones (solo modo memoria)
    ├── data/sharedMemoryHousehold.ts    UN repositorio de hogar y UN libro compartidos
    └── presentation/                    useMembersViewModel · MembersSection · memberNames
mobile/src/app/(tabs)/household.tsx      ruta fina → HouseholdScreen
```

## Decisiones y por qué

- **El balance se calcula en el dominio, no en la vista ni en el repositorio** (`computeBalance`): `net = paid − owed` en céntimos enteros; la suma de los `net` del hogar es **exactamente 0** (cada reparto suma su importe y una liquidación suma lo mismo al `paid` de quien paga y al `owed` de quien cobra); las transferencias sugeridas salen de `suggestTransfers` de `@icount/finance`, igual que en la API. Los repartos usan `previewSplit` con la regla del hogar (iguales, proporcional a ingresos, personalizada por categoría), y el céntimo sobrante va al primer miembro.
- **Solo cuentan los movimientos aprobados**; los pendientes se cuentan aparte para el aviso, y los rechazados no cuentan nunca (ADR-0016). Nadie aprueba lo suyo.
- **En memoria, un único libro** (`InMemoryHouseholdLedger`) guarda aprobaciones, comentarios y liquidaciones; el feed y el balance son dos adaptadores finos sobre él. El feed **se deriva en cada lectura** de los movimientos compartidos, las decisiones, los comentarios y las liquidaciones, así que un gasto añadido desde "+" aparece sin avisar a nadie. Como en un dispositivo no hay otra persona que apruebe, **lo que añado yo cuenta al instante** y, para poder ver el flujo, al unirse a un hogar de dos la primera lectura siembra tres gastos de la pareja (dos pendientes y uno ya aprobado).
- **Una condición de carrera real, corregida:** el balance y el feed se piden a la vez; la segunda lectura veía "ya sembrado" antes de que terminara la siembra y recibía la lista vacía. Ahora se guarda la **promesa** de la siembra por hogar y todos la esperan (hay un test que lo cubre al pintar la pantalla).
- **Los comentarios cuelgan del movimiento, no de los eventos**: las filas "aprobó…" o "comentó…" enlazan al movimiento pero no repiten el panel.
- **El rechazo exige motivo** en el caso de uso y en la vista (botón desactivado hasta escribirlo); la aprobación, no.
- **Claves de caché propias** (`householdKeys`): el fichero compartido `queryKeys.ts` es de la pista A. Aprobar invalida el feed, el contador y el balance a la vez.
- **Una vista, tres ViewModels**: balance, actividad y miembros fallan y cargan por separado; si el feed falla, el balance sigue ahí.
- **Accesibilidad**: cada fila del feed es un botón con su frase completa, importe y fecha; el filtro es un `tablist`; el titular del balance es un `header`; las transferencias se leen como una frase.

## Cómo probarlo

1. `npx expo start --port 8082` (modo memoria). Entra, y en la configuración del hogar **únete con cualquier código válido** (por ejemplo `ABCD2345`): se crea "Casa Ana & Leo".
2. Pestaña **Hogar**: balance, tres movimientos de Ana (dos por revisar), miembros y reparto.
3. **Aprobar** uno y mira cómo sube lo que debes y baja "por revisar"; **Rechazar** otro con motivo; **Comentar**.
4. Añade un gasto compartido desde "+": cuenta al instante y aparece en la actividad.
5. **Invitar a alguien** muestra un código y abre la hoja de compartir.

## Tests

- Dominio: `computeBalance` (reparto igual, céntimo indivisible con tres miembros, proporcional a ingresos, reparto guardado, no compartidos y pagadores que se fueron, liquidación que deja todo a cero, ingreso compartido con el signo invertido, suma siempre 0) y casos de uso (motivo obligatorio, comentario 1–500, liquidación válida, periodo al revés).
- Libro y adaptadores en memoria: siembra, filtro "por revisar", lo propio cuenta al instante, paginación con cursor, aprobar/rechazar y su efecto en el balance, no decidir dos veces ni lo propio, comentarios ordenados y contados, liquidaciones, periodo.
- Texto del feed (conjugación "Tú añadiste / Ana añadió", fechas relativas, errores) y la pantalla entera: balance, feed, filtro, aprobar, rechazar con motivo, comentar, invitar y compartir, hogar de uno, hogar al día, y el enlace profundo a la pestaña en `navigation.test.tsx`.
- **Sin probar en dispositivo:** el aspecto del feed con muchas filas.
- **Pendiente:** `ApiActivityRepository` y `ApiSettlementRepository` en el contenedor (5.9); el flujo de saldar es B-5.2; cambiar la regla de reparto desde esta pestaña (hoy solo se muestra; se elige al crear el hogar); notificaciones de "aprobación pendiente" (push, ADR-0017) llegan con el servidor.

## Para la entrevista

"El balance de cada miembro es lo que ha pagado menos lo que le toca, en céntimos enteros, y la suma del hogar es siempre cero porque cada reparto suma su importe; para saldar uso el voraz de la librería compartida, que es el mismo código que ejecuta el servidor. Los gastos que añade otra persona no cuentan hasta que los apruebas, así tu saldo nunca cambia a tus espaldas, y rechazar exige un motivo. En modo memoria el feed no se guarda: se deriva en cada lectura de los movimientos, las decisiones y los comentarios, de modo que no hay dos fuentes de verdad que se desincronicen. Encontré una condición de carrera al sembrar los datos de ejemplo —dos consultas simultáneas, y la segunda leía la lista vacía— y la resolví compartiendo la promesa de la siembra en lugar de un booleano."
