# Hogar compartido: balances, liquidaciones, aprobaciones y actividad (backend)

Código en `backend/src/modules/{settlements,activity}` y en el agregado `Transaction` (aprobación); contratos en `@icount/contracts` (`settlement.ts`, `activity.ts`); algoritmo en `@icount/finance` (`settle.ts`). Decisión: [ADR-0016](../adr/0016-balances-y-liquidaciones.md). En la app: `ApiSettlementRepository` y `ApiActivityRepository` (`mobile/src/features/{settlements,activity}/data/api`).

## Endpoints

| Método y ruta | Qué hace |
|---|---|
| `GET /v1/households/:id/balance?from&to` | Balance neto por miembro, transferencias sugeridas y nº de movimientos pendientes de aprobar |
| `GET / POST /v1/households/:id/settlements` | Lista (más recientes primero) y registra liquidaciones |
| `GET /v1/households/:id/activity?filter=all\|to-review&cursor&limit` | Feed del hogar, más reciente primero, paginado por cursor |
| `POST /v1/transactions/:id/approval` | Aprobar o rechazar (con motivo) un gasto compartido. Devuelve el evento creado |
| `GET / POST /v1/transactions/:id/comments` | Comentarios de un movimiento (los más antiguos primero) |

Como en el resto de la API, quien no es miembro recibe **404**, nunca 403: no se filtra si algo existe.

## Balance neto
Sobre los movimientos **compartidos que cuentan** (sin aprobación necesaria o aprobados) y las liquidaciones del periodo:

```
paid  = gastos compartidos pagados − ingresos compartidos recibidos + liquidaciones enviadas
owed  = sus partes (shares) de esos movimientos (con el mismo signo) + liquidaciones recibidas
net   = paid − owed        (> 0: le deben; < 0: debe)
```

- **Cinco consultas agregadas** (`GROUP BY` por pagador, por miembro de los *shares*, por emisor y receptor de liquidaciones y un `COUNT` de pendientes). La aritmética (netos y transferencias) se hace en el caso de uso.
- **Invariante: la suma de los netos es 0.** Cada movimiento reparte exactamente su importe (el céntimo sobrante va al pagador al crearlo) y cada liquidación suma y resta lo mismo. `suggestTransfers` lo comprueba y lanza un error si no se cumple, así que un descuadre nunca pasa desapercibido.
- Aparecen todos los miembros actuales (aunque estén a 0) y también los antiguos con movimientos. Sin ellos, los netos no sumarían 0.

## Transferencias sugeridas (`@icount/finance`)
Algoritmo voraz: el **mayor deudor paga al mayor acreedor** `min(deuda, crédito)`, se retira quien llega a 0 y se repite. Da como mucho **n − 1** transferencias, en céntimos enteros. Es **determinista**: los empates se resuelven por id, así que la app y la API sugieren lo mismo. Un test con 200 hogares aleatorios comprueba que todos quedan exactamente a 0.

## Aprobación de gastos compartidos
Vive en el **agregado `Transaction`**, porque es una regla del movimiento y no de la pantalla:
- Al crearlo (o editarlo), un movimiento compartido calcula sus **aprobadores**: los miembros con *share* salvo el autor. Si los hay, queda `pending`. Si no es compartido, `approvalStatus = null` (no necesita aprobación).
- `decide(member, approve|reject, reason)`: nadie aprueba lo suyo (`cannot-approve-own`, 422), solo deciden los aprobadores (`not-an-approver`, 403) y una sola vez (`already-decided`, 409). Rechazar exige motivo.
- **Aprobado** cuando todos los aprobadores aprueban. **Un rechazo basta** para rechazarlo.
- **Editar** un movimiento compartido abre una ronda nueva: se borran los votos y vuelve a `pending`.
- Los votos se guardan en `transaction_approvals` (PK `(transaction_id, member_id)`). El repositorio los reemplaza al guardar, igual que los *shares*.

Los movimientos que crea el trabajo de recurrentes siguen la misma regla. Su autor es quien creó la serie.

## Actividad
- **`ActivityLog`** es un puerto que cualquier módulo usa para anotar eventos (`transaction-created/updated/deleted/approved/rejected`, `settlement-created`, `member-joined`, `comment-added`). Lo registra un módulo **global**, así que transacciones, hogares y liquidaciones lo inyectan sin importar el módulo de actividad (que a su vez depende de transacciones). Así no hay ciclo de imports.
- Se escribe **en la misma transacción de base de datos** que el cambio (`TransactionRunner` + `AsyncLocalStorage`): si el cambio falla, el evento no existe, y viceversa.
- `activities` no tiene FK a movimientos ni a liquidaciones **a propósito**: "Ana borró «Compra»" debe sobrevivir al movimiento. Guarda una copia del importe y la descripción.
- Al leer, cada página se completa con el **estado actual** del movimiento (aprobación y nº de comentarios) en tres consultas por página, sin N+1.
- Filtro **`to-review`**: movimientos `pending` en los que participo, que no he creado y sobre los que aún no he decidido. Sale una fila por movimiento (su último evento de alta o edición). Las columnas de la subconsulta van cualificadas a mano por la lección de la fase 4.
- Paginación por **cursor** `(occurred_at, id)` con índice `(household_id, occurred_at DESC, id DESC)`.

## Liquidaciones
`from → to`, importe, método (`bizum`, `bank-transfer`, `cash`, `other`), nota y día. **Cuentan en el acto** (no necesitan aprobación) y no entran en presupuestos ni en el resumen mensual, porque no son gastos. Se valida que ambos son miembros, que son distintos, la divisa del hogar y que el importe es positivo.

## Modelo de datos (migración `0007`)
`transactions.approval_status`, `transaction_approvals`, `settlements`, `activities` (índice del feed y por movimiento), `comments` (FK en cascada al movimiento). Los movimientos existentes quedan con `approval_status = null`: cuentan como hasta ahora.

## Tests
- Unitarios: aprobación en `Transaction` (3 miembros, rechazo con motivo, nueva ronda al editar), validación de `Settlement` y el voraz (céntimos impares, empates, 200 hogares aleatorios).
- E2E (`test/shared-household.e2e-spec.ts`), con tres miembros reales que se unen con códigos de invitación: un gasto de 100,01 € no cuenta hasta que los dos aprueban; los netos suman 0; el rechazo lo deja fuera; editar vuelve a pedir aprobación; una liquidación deja al deudor a 0; el filtro por periodo; el feed completo con paginación y comentarios; y que los ajenos al hogar reciben 404 en todo.

## Para la entrevista

**En 30 segundos:** "El balance es lo pagado menos lo que te toca, solo sobre lo aprobado, y la suma del hogar es cero por construcción (lo verifico en tests y en tiempo de ejecución). Para saldar uso un voraz en un paquete compartido con la app: como mucho n−1 pagos, determinista. La aprobación es una regla del agregado `Transaction`, no de la UI: un gasto que añade otro no cambia tu saldo hasta que lo apruebas. Y todo lo que pasa se anota en un feed mediante un puerto global, dentro de la misma transacción de base de datos que el cambio."

Preguntas probables:
- *¿Por qué la aprobación en el agregado y no en un servicio aparte?* Porque es un invariante del movimiento ("si cambia, vuelve a pendiente"). En el agregado nadie puede saltárselo, igual que el reparto de céntimos. Analogía: la lógica en el modelo de dominio y no en el ViewModel.
- *¿Por qué el feed no usa FK a movimientos?* Porque es un histórico: borrar el movimiento no debe borrar que existió. A cambio, guarda una copia del importe y la descripción.
- *¿Cómo evitas el ciclo actividad ↔ transacciones?* Inversión de dependencias: el puerto `ActivityLog` vive en el dominio de actividad, su implementación se registra de forma global y los demás módulos dependen solo de la abstracción (como un `interface` en un módulo `:core` de Gradle).
- *¿Y con miles de movimientos?* El balance son agregados SQL apoyados en índices. Si creciera mucho, una vista materializada por mes.
