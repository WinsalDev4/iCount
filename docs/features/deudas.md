# Feature: Deudas

Tarea B-4.2 · Pantalla 08 del lienzo, maquetación **B · Detalle + simulador** con la estrategia de la **C** ([ADR-0009](../adr/0009-direccion-visual-midnight-glass.md)) · Motor: [ADR-0015](../adr/0015-motor-financiero-compartido.md)

## Qué hace

- **Lista**: lo que debes en total y lo que pagas al mes, con una tarjeta por deuda (barra de progreso, tipo de interés y próxima cuota). Las pagadas quedan al final.
- **Detalle**: un anillo de progreso con el % pagado, lo pendiente, la cuota, la fecha de fin, la próxima cuota y cuántas te quedan; y el **simulador de pago extra** con chips (_sin extra · +50 € · +100 € · +200 €_): "terminas 1 año y 3 meses antes · ahorras 612 € en intereses · acabarías en junio de 2029 en vez de septiembre de 2030". Se calcula **en el dispositivo**, al instante y sin conexión.
- **Estrategia**: **avalancha** (primero el tipo más alto) frente a **bola de nieve** (primero la deuda más pequeña) con el mismo dinero al mes: fecha libre de deudas, intereses totales y el orden de cada una, más una recomendación en una frase.
- **Alta y edición**: nombre, tipo, importe prestado, TIN, plazo, cuota (opcional: si se deja vacía se calcula con el método francés) y fecha de la primera cuota con botones ±1 mes / ±1 año.

**Analogía:** el simulador es el "¿y si pago más?" de las calculadoras de hipoteca; el motor es una librería de cálculo pura compartida, como un módulo KMP `commonMain` que usan Android, iOS y el servidor.

## Cómo está construida

```
mobile/src/features/debts/
├── domain/
│   ├── debtMath.ts            fechas de cuota, próxima cuota, cuotas restantes, % pagado, totales
│   ├── payoffPlans.ts         computePayoffPlan() sobre @icount/finance (una sola vez)
│   ├── parseRateInput.ts      "6,9" → 690 puntos básicos (sin floats) / formatRate
│   └── usecases/              ListDebts · GetDebt · CreateDebt · UpdateDebt · DeleteDebt
│                              · SimulateExtraPayment · ComparePayoffStrategies
├── data/InMemoryDebtRepository.ts     usa el motor: saldo, fecha de fin y cuadro salen de él
├── presentation/              ViewModels + DebtsScreen · DebtDetailScreen · DebtFormScreen · StrategyScreen
└── debts.module.ts
mobile/src/app/debts/{_layout,index,[id],edit,strategy}.tsx
```

## Decisiones y por qué

- **Las simulaciones viven en el dominio y usan `@icount/finance` directamente** (`SimulateExtraPayment`, `ComparePayoffStrategies`), no pasan por el repositorio: son puras, instantáneas y funcionan sin red. El servidor usa el _mismo_ motor como fuente de verdad, así que app y API no pueden discrepar.
- **El repositorio en memoria solo guarda las condiciones del préstamo.** El saldo pendiente, la fecha de fin y el cuadro de amortización se derivan en cada lectura con el motor (`outstandingBalance`, `amortizationSchedule`), igual que hace la API; el balance depende de "hoy", por eso no se guarda.
- **La simulación parte de lo que debes hoy y de la próxima cuota**, no del préstamo original: `principal = saldo pendiente`, `primera cuota = próxima cuota`. Así "terminas N meses antes" habla del futuro real.
- **Cuota por debajo de los intereses = error claro**, no un bucle infinito: el motor lanza `PaymentTooLowError` y el dominio lo traduce a `DebtError('invalid')` ("la cuota tiene que cubrir al menos los intereses del mes").
- **Fechas de cuota con día ancla**: una cuota del 31 cae el 28 (29 en bisiesto) en febrero y vuelve al 31 en marzo (`addMonths` del motor). `nextInstallmentDate` y `remainingInstallments` cuentan hoy como cuota si vence hoy.
- **Tipos en puntos básicos y texto → entero**: `parseRateInput` convierte "6,9" en 690 sin pasar por decimales (como el dinero en céntimos, ADR-0007).
- **Editar no toca el pasado**: el importe prestado y la fecha de inicio se muestran pero no se editan. Cambiar el tipo o el plazo **recalcula la cuota** salvo que se indique una nueva.
- **Avalancha vs bola de nieve con la misma bolsa**: suma de todas las cuotas + el extra; cuando una deuda se salda, su cuota "rueda" a la siguiente. El resultado dice cuánto ahorra la avalancha (nunca negativo) y, si no hay diferencia, lo reconoce ("cuestan lo mismo: elige la que más te motive") y destaca la primera victoria de la bola de nieve.
- **Rutas protegidas**: la carpeta `debts` va dentro de la fase `ready`; la entrada "Deudas" del hub de Planificar se activa.
- **Accesibilidad**: el anillo y las barras son `progressbar` con su porcentaje; el resultado del simulador es una región viva (`polite`) para que el lector anuncie el cambio al pulsar un chip; el borrado pide confirmación dentro de la pantalla.

## Cómo probarlo

1. `npx expo start --port 8082` (modo memoria: cada hogar trae tres deudas de ejemplo).
2. **Planificar → Deudas**: lista y totales. Toca una deuda y juega con los chips.
3. **Avalancha o bola de nieve**: cambia el extra y mira cómo se mueven las fechas.
4. **Añadir deuda** (prueba una cuota muy baja para ver el error) y **Editar**/**Eliminar** desde el detalle.

## Tests

- Dominio: `debtMath` (31 y febrero bisiesto, próxima cuota, restantes, totales), `parseRateInput`, validaciones de los casos de uso y los dos simuladores (más extra ahorra más; sin extra no cambia nada; deuda saldada → `null`; cuota insuficiente → error de dominio; avalancha ≤ bola de nieve en intereses).
- Repositorio en memoria contra el motor: cuota francesa, saldo según las cuotas ya vencidas, fecha de fin, cuadro que acaba en 0 y suma el principal exacto, edición que recalcula, plan de pago y datos de ejemplo.
- ViewModels (lista, detalle con simulador, formulario, estrategia) y pantallas, y el recorrido Planificar → Deudas → estrategia → detalle en `navigation.test.tsx`.
- Sin probar en dispositivo: el aspecto del anillo y las tarjetas.
- **Pendiente:** `ApiDebtRepository` en el contenedor (4.9); mostrar el cuadro de amortización completo (el caso de uso ya existe); TAE editable.

## Para la entrevista

"El simulador de pago extra no llama al servidor: ejecuta en el dispositivo la misma librería de cálculo —puras funciones sobre céntimos enteros— que usa la API, así que responde al instante, funciona sin conexión y no puede discrepar del servidor. Parte del saldo pendiente de hoy y de la próxima cuota, y si la cuota no cubre los intereses el motor lo detecta y la app lo explica en vez de colgarse. El repositorio en memoria solo guarda las condiciones del préstamo; saldo, fecha de fin y cuadro se derivan con el motor, como en la API. Para comparar estrategias doy a las dos la misma bolsa mensual —todas las cuotas más el extra— y la cuota de cada deuda saldada rueda a la siguiente; la avalancha minimiza intereses y la bola de nieve da victorias rápidas, y la pantalla dice cuánto cuesta cada una."
