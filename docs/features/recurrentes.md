# Feature: Pagos recurrentes

Tarea B-4.3 · Pantalla 08-D del lienzo (lista + calendario de vencimientos) ([ADR-0009](../adr/0009-direccion-visual-midnight-glass.md)) · Recordatorios locales: complementa al push remoto de [ADR-0017](../adr/0017-notificaciones-push.md)

## Qué hace

- **Lista**: lo que vence en los próximos 30 días (con el total de gastos), cada vencimiento con su fecha y "en 3 días", y debajo **tus pagos recurrentes** con su periodicidad ("cada mes, el día 5", "cada año, el 15 de junio") y el siguiente vencimiento.
- **Calendario**: el mes con los días que tienen vencimientos marcados (más intensidad = más pagos), un resumen ("Pagos del mes: 128,99 €") y, al tocar un día, sus pagos. Reutiliza el `CalendarGrid` del historial.
- **Alta y edición**: nombre, tipo (factura, letra, suscripción, ingreso, otro), importe, **periodicidad** (cada mes, 3 meses, 6 meses o cada año), primer vencimiento, categoría y, si el hogar tiene más miembros, "compartido". Editar cambia todo menos el primer vencimiento; eliminar pide confirmación dentro de la pantalla.
- **Recordatorio**: un interruptor "Avisarme el día antes". Al activarlo se pide el permiso de notificaciones **en ese momento** (nunca al abrir la app) y se programa una notificación local a las **9:00 del día anterior** a cada gasto que vence. Al tocarla se abre esta pantalla.

**Analogía:** los recordatorios son `AlarmManager` + `NotificationManagerCompat` en Android, o `UNUserNotificationCenter` con disparadores de fecha en iOS; el puerto `RemindersScheduler` es la interfaz que los esconde, como un `interface` de `commonMain` con dos `actual`.

## Cómo está construida

```
mobile/src/features/recurring/
├── domain/
│   ├── recurrenceMath.ts      fechas de vencimiento y próxima fecha sobre @icount/finance, texto de la regla, periodicidades
│   ├── reminderPlans.ts       qué recordatorios toca programar (9:00 del día antes, solo gastos, máximo 50)
│   ├── RemindersScheduler.ts  puerto: permiso, programar "exactamente estos", cancelar
│   └── usecases/              List · Create · Update · Delete · ListUpcomingDues · SyncReminders
├── data/
│   ├── InMemoryRecurringRepository.ts   usa el motor de recurrencia; guarda solo la regla
│   ├── ExpoRemindersScheduler.ts        adaptador de expo-notifications (SDK 57)
│   └── remindersPreferenceStore.ts      Zustand persistido: ¿recordatorios activados?
├── presentation/              ViewModels + RecurringScreen · RecurringFormScreen
└── recurring.module.ts
mobile/src/app/recurring/{_layout,index,edit}.tsx
```

## Decisiones y por qué

- **El motor de recurrencia es el de `@icount/finance`** (`occurrencesBetween`, `nextOccurrence`): el mismo que usa el job del servidor al generar los movimientos, así que la previsión de la app y lo que luego se registre no pueden discrepar. Un día 31 cae el último día de los meses cortos (28/29 en febrero) y vuelve al 31.
- **El repositorio en memoria solo guarda la regla y las fechas de inicio y fin.** El siguiente vencimiento y los vencimientos de un rango se calculan al leer, como hace la API. **No genera movimientos**: convertir un vencimiento en gasto es trabajo del job del servidor (A-4.3); aquí solo se prevé.
- **La regla se ancla en el primer vencimiento.** El día (y el mes, en los anuales) salen de la fecha que elige la persona, así que no hay un campo "día del mes" que pueda contradecir a la fecha. Al editar se conserva el día y solo cambia la periodicidad (`ruleWithFrequency`); una regla personalizada que la app no ofrece (p. ej. cada 2 meses) se respeta hasta que se elija una periodicidad.
- **Recordatorios por ventana, no por repetición.** Se programan solo los de los próximos 45 días (como mucho 50, porque iOS admite 64 notificaciones locales pendientes para toda la app), cada uno con un identificador `recurring:<pago>:<fecha>`. `SyncReminders` es idempotente: sustituye _exactamente_ los de esta feature (nunca toca el push ni otras notificaciones) y se ejecuta al activar el interruptor, al abrir la pantalla y tras cada cambio, de modo que la ventana avanza sola. Un recordatorio cuya hora ya pasó (vence hoy, o mañana después de las 9:00) se omite.
- **Solo gastos.** Un ingreso no necesita aviso.
- **El permiso se pide en contexto y se comprueba cada vez.** Si el sistema lo rechaza el interruptor queda apagado y se explica cómo activarlo en Ajustes; si la persona lo revoca después, al abrir la pantalla se apaga solo con un aviso en vez de fingir que avisa. El permiso y el canal de Android reutilizan la pasarela que ya usa el registro del push (`expoNotificationsGateway`), así que ambos preguntan igual.
- **Cargado perezoso del módulo nativo.** `ExpoRemindersScheduler` hace `require` de `expo-notifications` en el primer uso, de modo que construir el contenedor (tests, web) nunca carga código nativo.
- **Un fallo nativo no rompe la pantalla**: se ve un mensaje ("No hemos podido programar los avisos") y la sincronización silenciosa al abrir ignora los errores.
- **Accesibilidad**: el interruptor tiene su etiqueta y estado, el calendario tiene etiqueta por día ("sábado 17: 2 vencimientos"), el cambio de mes y los avisos son regiones vivas (`polite`).

## Cómo probarlo

1. `npx expo start --port 8082` (modo memoria: cada hogar trae cinco pagos de ejemplo). Las notificaciones locales se prueban con la _development build_ del proyecto (ADR-0002).
2. **Planificar → Recurrentes**: lista, calendario y detalle por día.
3. Activa **Avisarme el día antes**: aparece el permiso del sistema. Prueba a rechazarlo y a revocarlo en Ajustes.
4. **Añadir pago recurrente**: crea uno con vencimiento mañana y otro de aquí a dos días y comprueba que se programa el segundo (el del día siguiente a las 9:00 ya pasó).

## Tests

- Dominio: fechas con día 31 y febrero bisiesto, anuales y trimestrales, inicio y fin de la serie, texto de la regla, periodicidades, y `planReminders` (9:00 del día antes, solo gastos, omitir los pasados, cambio de mes, identificador estable, tope de 50).
- Casos de uso: validación (nombre, importe, intervalo, día, anual sin mes, fin antes del inicio), orden de la lista (los terminados al final) y `SyncReminders` (ventana de 45 días, sin ingresos, lista vacía que borra los antiguos).
- Repositorio en memoria contra el motor: crear, editar con regla nueva, terminar, borrar, previsión ordenada y datos de ejemplo una sola vez.
- Adaptador: solo sustituye lo suyo, programa con disparador de fecha y canal, cancelar deja el resto, y el permiso pasa por la pasarela.
- ViewModels y pantallas: lista, calendario (marcas, resumen, mes siguiente), interruptor (permiso en contexto, rechazo, revocado en Ajustes, apagar, fallo nativo, renovar al abrir), formulario completo y recorrido Planificar → Recurrentes → calendario en `navigation.test.tsx`.
- **Sin probar en dispositivo:** que la notificación llegue de verdad a la hora (lo verifica la 4.9 en el emulador) y el aspecto del calendario con marcas.
- **Pendiente:** `ApiRecurringPaymentRepository` en el contenedor (4.9); poner fecha de fin desde la app; ligar un recurrente a una deuda (`debtId`); aviso configurable (hora y antelación).

## Para la entrevista

"La previsión de vencimientos usa la misma librería de cálculo que el servidor, con días ancla como el 31 que caen el último día de los meses cortos, así que lo que ve la persona en el calendario es lo que luego generará el job. Los recordatorios son notificaciones locales, sin servidor: programo una ventana de 45 días con identificadores estables y cada sincronización sustituye exactamente las mías, de modo que es idempotente y no pisa el push remoto; se renueva al abrir la pantalla y tras cada cambio. El permiso se pide en contexto —al activar el interruptor— y se vuelve a comprobar al abrir, porque la persona puede revocarlo en Ajustes. Todo lo nativo está detrás de un puerto (`RemindersScheduler`), así que la lógica se prueba con un falso y el adaptador de Expo se carga de forma perezosa."
