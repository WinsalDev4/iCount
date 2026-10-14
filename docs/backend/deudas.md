# Deudas (backend)

Código en `backend/src/modules/debts`; contratos en `@icount/contracts` (`debt.ts`); cálculos en `@icount/finance` (`amortization.ts`, `payoff.ts`). En la app, `ApiDebtRepository` (y también `ApiBudgetRepository` y `ApiRecurringPaymentRepository`, de la misma tarea) en `mobile/src/features/*/data/api`.

## Endpoints

| Método y ruta | Qué hace |
|---|---|
| `GET / POST /v1/households/:id/debts` | Lista y crea préstamos (coche, hipoteca, personal, tarjeta…) |
| `GET / PATCH / DELETE /v1/debts/:id` | Detalle, edición (nombre, tipo, TIN, TAE, cuota, plazo) y borrado |
| `GET /v1/debts/:id/schedule` | Cuadro de amortización completo |
| `GET /v1/households/:id/debts/strategy?strategy=avalanche\|snowball&extraMonthlyMinor=` | Plan de pago de todas las deudas con un extra mensual |
| `GET /v1/debts/:id/payments` | Movimientos enlazados como pagos |
| `PUT / DELETE /v1/debts/:id/payments/:transactionId` | Enlaza (idempotente) o desenlaza un movimiento |

## Qué se guarda y qué se calcula
Se guardan **solo los datos del contrato**: capital, TIN y TAE en puntos básicos (6,90 % → `690`, enteros como el dinero, ADR-0007/0015), cuota, fecha de la primera cuota y plazo. Todo lo demás se **deriva al leer** con `@icount/finance`, el mismo código que usa la app sin conexión:

- **Cuota francesa** si el usuario no la indica: `C = P·i / (1 − (1+i)^−n)`, redondeada al céntimo.
- **Cuadro de amortización**: interés del mes = saldo × TIN/12 (redondeo *half away from zero*), amortizado = cuota − interés. Si la cuota es la contractual, **la última absorbe el residuo** de redondeo y el préstamo acaba justo en el plazo. Si el usuario paga más, el préstamo termina antes.
- **Saldo pendiente hoy** (`outstanding`) suponiendo las cuotas pagadas en fecha, y **fecha de fin** al ritmo actual.
- Una cuota que no cubre los intereses se rechaza (`invalid-debt`, 422): no terminaría nunca.

"Hoy" es un puerto (`TODAY`, en el *shared kernel*) calculado en la zona del hogar (`Europe/Madrid`). Así, los tests pueden fijar la fecha y el trabajo de recurrentes y las deudas comparten la misma noción de día.

## Pagos enlazados a movimientos
Un pago es un **gasto de la categoría Préstamos** (`loans`) del mismo hogar, enlazado en `debt_payments (debt_id, transaction_id)`:
- Cualquier otro movimiento se rechaza con `invalid-debt-payment` (422).
- Enlazar dos veces no hace nada (PK compuesta + `ON CONFLICT DO NOTHING`).
- Borrar la deuda borra los enlaces, **no los movimientos**. Borrar el movimiento borra su enlace (FK en cascada).

**Integración con recurrentes:** un pago recurrente con `debtId` (la letra del coche) enlaza **automáticamente** cada movimiento que crea el trabajo diario con su deuda, dentro de la misma transacción. Al crearlo se valida que la deuda es del mismo hogar y que el recurrente es un gasto. `recurring_payments.debt_id` tiene ya su FK (`ON DELETE SET NULL`): si se borra la deuda, la serie sigue y deja de enlazar.

## Estrategias: avalancha y bola de nieve
`payoffPlan` simula mes a mes, desde el día 1 del mes siguiente, con los saldos pendientes de hoy:
- Todas las deudas reciben su cuota mínima y el **extra** va a la prioritaria: la de **mayor TIN** (avalancha) o la de **menor saldo** (bola de nieve).
- Cuando una deuda se salda, su cuota se suma al extra (*rollover*).
- Devuelve el orden, la fecha de pago de cada deuda, los intereses de cada una y totales, y la fecha en que el hogar queda libre de deudas. Si no hay nada que pagar, `debtFreeDate` es `null` y la app lo muestra como "hoy".

La avalancha minimiza intereses. La bola de nieve da victorias rápidas, que motivan. El e2e comprueba que los intereses de la avalancha nunca superan a los de la bola de nieve.

## Modelo de datos (migración `0006`)
- `debts`: importes `bigint` en céntimos, tipos `integer` en puntos básicos, fechas `DATE`, índice por hogar, FK en cascada al hogar.
- `debt_payments`: PK `(debt_id, transaction_id)`, ambas FK en cascada.
- `recurring_payments.debt_id → debts.id ON DELETE SET NULL`.

## Cambios relacionados
- `POST /v1/budgets/move` (antes colgaba del hogar). El hogar se deduce de los presupuestos, que deben compartirlo. Así encaja 1:1 con `BudgetRepository.moveAmount(fromId, toId, amount)` de la app.
- Contrato: `debtFreeDate` admite `null`.

## Repositorios de API en la app
Cada uno implementa el puerto que ya usaba la pista B contra memoria (como un `Retrofit` detrás de una interfaz de repositorio en Android, o un `URLSession` tras un protocolo en iOS):
- **Mappers puros** DTO ↔ dominio: los días de calendario viajan como `YYYY-MM-DD` y se convierten a medianoche **local** (nunca `toISOString`, que es UTC). Los importes pasan a `Money` y los PATCH llevan solo los campos cambiados.
- **Errores**: el `type` de ProblemDetails (`/problems/duplicate-budget`…) se traduce al error de cada feature (`BudgetError('duplicate')`, `DebtError('invalid')`…). Sin conexión o con *timeout* → `network`.
- Validación con Zod en la frontera: si el servidor rompe el contrato, falla como `validation` (un bug), no como dato corrupto en la UI.

## Para la entrevista

**En 30 segundos:** "De una deuda guardo solo el contrato: capital, TIN en puntos básicos, cuota, inicio y plazo. El cuadro de amortización, el saldo de hoy y la fecha de fin se calculan al leer, con un paquete TypeScript compartido entre la API y la app, así que coinciden al céntimo incluso sin conexión. Los pagos son movimientos de la categoría Préstamos enlazados a la deuda, y la letra recurrente se enlaza sola en el trabajo diario. La estrategia avalancha o bola de nieve simula mes a mes con *rollover* de cuotas."

Preguntas probables:
- *¿Por qué no guardar el saldo pendiente?* Porque se desincroniza: cambiar la cuota, el tipo o la fecha obligaría a recalcularlo en todas partes. Derivarlo es barato (como mucho, cientos de filas) y siempre es coherente.
- *¿Por qué puntos básicos y no `6.9`?* Por la misma razón que los céntimos: sin coma flotante en dinero ni en tipos (`0.1 + 0.2 ≠ 0.3`).
- *¿Cómo cuadra la última cuota?* Al redondear cada mes queda un residuo de céntimos. La última cuota lo absorbe y el saldo final es exactamente 0, como en los cuadros de los bancos.
- *¿Por qué avalancha ≤ bola de nieve en intereses?* Porque dirigir el extra a la deuda más cara reduce antes la base que más interés genera. Lo verifica un test.
