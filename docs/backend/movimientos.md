# Movimientos y categorías (backend)

Gastos e ingresos de un hogar, con su **reparto por miembro**, listados paginados, resumen mensual y totales diarios. Código en `backend/src/modules/{categories,transactions}`. Contratos en `@icount/contracts` (`transaction.ts`, `category.ts`).

## Endpoints (todos autenticados y solo para miembros del hogar)

| Método y ruta | Qué hace |
|---|---|
| `GET /v1/households/:id/categories` | Categorías por defecto (en español) + las propias del hogar |
| `POST /v1/households/:id/categories` | Crea una categoría propia (id UUID) |
| `POST /v1/households/:id/transactions` | Crea un movimiento (201; **200** si se repite el mismo `id` del cliente) |
| `GET /v1/households/:id/transactions?…` | Lista paginada por **cursor**, del más reciente al más antiguo, con filtros |
| `GET /v1/households/:id/summary?month=YYYY-MM` | Ingresos, gastos, balance y gasto por categoría |
| `GET /v1/households/:id/daily-totals?month=YYYY-MM` | Totales por día (mapa de calor del historial) |
| `GET / PATCH / DELETE /v1/transactions/:id` | Detalle, edición parcial (recalcula el reparto) y borrado |

Filtros del listado: `type`, `categoryId`, `memberId` (pagador o con parte en el reparto), `shared`, `from`/`to` (días inclusive) y `q` (texto de la descripción; `%` y `_` se tratan como texto literal, no como comodines).

Errores: `unknown-category` y `category-type-mismatch` (422), `payer-not-member` (422), `not-shared-household` (422), `currency-mismatch` (422), `transaction-id-conflict` (409), `transaction-not-found` (404) e `invalid-cursor` (422).

## Reglas del dominio
- **Importe positivo en céntimos** (`BIGINT`), con el signo dado por `type`. La divisa es la del hogar.
- **La fecha es un día de calendario** (`DATE`, no `TIMESTAMP`): el gasto ocurre *el día 6*, sin zona horaria, así que el calendario no se desplaza según dónde estés.
- **El pagador debe ser miembro.** Por defecto es quien crea el movimiento.
- **Reparto (`shares`)**: si el movimiento es compartido, se aplica la `SplitRule` del hogar con `splitAmount` de `@icount/finance`:
  - partes iguales;
  - proporcional a los ingresos declarados (vuelve a partes iguales si alguien no los ha declarado);
  - porcentaje a medida por categoría (en puntos básicos).

  Cada parte se redondea a la baja y **los céntimos sobrantes van al pagador**, así que **las partes suman siempre el importe exacto**: 10,01 € entre dos son 5,01 € para quien paga y 5,00 € para el otro. Editar el importe, el pagador o la categoría recalcula el reparto.
- Los hogares `personal` no admiten movimientos compartidos.
- **Creación idempotente**: la app puede enviar su propio `id`. Si la misma persona repite la petición (por ejemplo, tras un *timeout*), se devuelve lo ya guardado con 200 en vez de duplicar. Si el `id` lo usó otra persona u otro hogar, es un 409.

## Por qué paginación por cursor y no por *offset*

| | `?page=3&size=20` (OFFSET) | `?cursor=…` (*keyset*) |
|---|---|---|
| Si entran movimientos nuevos mientras haces *scroll* | Todo se desplaza: **repites o te saltas filas** | Cada página empieza justo después del último elemento visto: **estable** |
| Coste en la página 500 | PostgreSQL lee y descarta 10.000 filas | Usa el índice y va directo: **constante** |
| ¿Saber el total de páginas? | Sí (con un `COUNT(*)` extra) | No hace falta para un *scroll* infinito |

Implementación:
- Orden total por `(occurred_on DESC, created_at DESC, id DESC)`. El `id` desempata y hace el orden determinista.
- El cursor es `base64url(JSON)` de esos tres valores del último elemento. Es **opaco** para el cliente y se valida con zod al recibirlo, así que uno manipulado da 422.
- La consulta usa comparación de filas: `WHERE (occurred_on, created_at, id) < ($1, $2, $3)`.
- Se piden `limit + 1` filas. Si llega la extra, hay página siguiente, sin necesidad de `COUNT(*)`.

## Índices (justificados)
- `transactions (household_id, occurred_on DESC, created_at DESC, id DESC)`: el listado, el resumen del mes y los totales diarios filtran por hogar y rango de días, y el listado ordena exactamente así. Un solo índice sirve a los tres.
- `transaction_shares (transaction_id, member_id)` como PK, más un índice por `member_id`: el filtro "donde participo" y los balances por miembro de la fase 5.
- `categories (household_id)`: las categorías propias de un hogar.
- Sin índice de texto para `q`: dentro de un hogar hay pocos miles de filas y el índice del hogar ya acota la búsqueda. Si creciera, `pg_trgm` con un índice GIN.

## Agregados en SQL
El resumen y los totales diarios se calculan en la base de datos con `SUM(CASE WHEN type = … THEN amount_minor END)` agrupando por categoría o por día, y vuelven como enteros. Así no hay que traer los movimientos a Node ni sumar en coma flotante.

## Para la entrevista

**En 30 segundos:** "Cada movimiento compartido guarda su reparto en céntimos aplicando la regla del hogar, con una función pura compartida con la app. Los céntimos que no se dividen exactos van al pagador, así que la suma cuadra siempre. El listado usa paginación por cursor sobre un índice compuesto: es estable aunque entren datos nuevos y cuesta lo mismo en la página 1 que en la 500. Las fechas son días de calendario, los importes `BIGINT` en céntimos, y la creación es idempotente con un id del cliente para que los reintentos y las altas optimistas no dupliquen."

Preguntas probables:
- *¿Por qué guardar el reparto en vez de calcularlo al leer?* Si cambia la regla del hogar, los gastos pasados deben conservar el reparto con el que se aprobaron. Además, los balances de la fase 5 suman filas en vez de recalcular reglas.
- *¿Cómo evitas el doble alta si la red falla?* Con el id generado en el cliente: el reintento encuentra la fila y devuelve la misma respuesta.
- *¿Y si dos personas editan el mismo gasto?* Gana la última escritura. La fase 5 añade aprobación de movimientos compartidos y un feed de actividad, y un control de versión (`updatedAt` como ETag) sería el siguiente paso si hiciera falta.
