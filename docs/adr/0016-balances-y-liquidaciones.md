# ADR-0016: Balances netos, mínimas transferencias y aprobación de gastos compartidos

- **Estado:** Aceptado
- **Fecha:** 2026-10-14

## Contexto
La fase 5 completa la economía compartida: quién ha pagado qué, cuánto le toca a cada uno y cómo quedar en paz con el menor número de pagos. Partimos de que:
- Cada movimiento compartido guarda su **reparto por miembro** (`shares`), calculado por el backend con la `SplitRule` del hogar (fase 3). El céntimo sobrante va al pagador.
- Varias personas escriben en el mismo hogar. Un gasto compartido que añade otro miembro **cambia lo que yo debo** sin que yo intervenga.

## Opciones consideradas
**Cálculo del balance**
1. Deudas **por pareja** (A debe a B, B debe a C…): explota con muchos miembros y obliga a saldar en cadena.
2. **Balance neto por miembro** + sugerencia de transferencias ← elegida.

**Transferencias sugeridas**
1. **Óptimo exacto** (mínimo número de transferencias): es NP-difícil en general (equivale a particionar subconjuntos de suma cero).
2. **Voraz**: emparejar siempre al mayor deudor con el mayor acreedor ← elegida.

**Movimientos de otros**
1. Contarlos en el acto.
2. **Pendientes hasta que los aprueben los demás** ← elegida.

## Decisión

### Balance neto
Para cada miembro y periodo, sobre los movimientos compartidos **aprobados** y las liquidaciones registradas:
- `paid` = lo que ha pagado en gastos compartidos (+ lo que ha **enviado** en liquidaciones);
- `owed` = la suma de sus `shares` (+ lo que ha **recibido** en liquidaciones);
- `net = paid − owed`. Si es positivo, los demás le deben; si es negativo, debe.

Invariante: **la suma de los `net` de un hogar es exactamente 0**, porque los `shares` de cada movimiento suman su importe. Se comprueba en los tests.

Los ingresos compartidos (raros, como un reembolso común) cuentan con el signo invertido.

### Transferencias sugeridas (algoritmo voraz)
1. Separar deudores (`net < 0`) y acreedores (`net > 0`). Ordenarlos por importe absoluto descendente y, en caso de empate, por id (resultado determinista).
2. Emparejar el mayor deudor con el mayor acreedor y transferir `min(|deuda|, crédito)`.
3. Restar, retirar a quien llegue a 0 y repetir.

Produce como mucho **n − 1** transferencias para n miembros con saldo y trabaja en céntimos enteros, así que no se pierde nada por redondeo. Con 2–6 miembros, que es el caso real de un hogar, suele coincidir con el óptimo. Vive en **`@icount/finance`** (`suggestTransfers`) para que la app (modo memoria, vista previa) y la API calculen lo mismo ([ADR-0015](0015-motor-financiero-compartido.md)).

### Aprobación
- Un **gasto compartido** creado por un miembro queda **`pending`** para los demás. **No cuenta en el balance** hasta que todos los afectados lo aprueban. Si alguien lo **rechaza** (con motivo obligatorio), se queda como rechazado y no cuenta. El autor puede editarlo y vuelve a `pending`.
- Los movimientos **no compartidos** y los de un hogar **personal** no necesitan aprobación.
- Nadie aprueba lo suyo. Lo que crea un miembro sí cuenta en el acto para su propia vista de "pendiente de que lo aprueben".
- `pendingApprovalCount` se devuelve junto al balance para que la UI diga "hay 2 gastos por revisar que aún no cuentan".

### Liquidaciones
Una liquidación (`from → to`, importe, método, nota) es un movimiento especial que cuenta en el acto, sin aprobación, porque solo afecta a quien la registra y al receptor, que la ve en la actividad. No es un gasto: no entra en presupuestos ni en el resumen mensual.

## Por qué
- El balance neto escala con cualquier número de miembros y hace que "saldar" sea un paso, no una cadena.
- El voraz es simple, explicable en una entrevista y suficiente para el tamaño de un hogar.
- La aprobación evita la principal fuente de conflictos en apps de gastos compartidos: que tu saldo cambie por algo que no has visto. Hace el balance **auditable**.

## Consecuencias
- El feed de actividad tiene un filtro "por revisar".
- Los repartos se recalculan al editar un movimiento, que vuelve a `pending` si es compartido.
- Notificar "aprobación pendiente" es un evento *push* ([ADR-0017](0017-notificaciones-push.md)).
- A-5.1 implementa balance, voraz (en `@icount/finance`), aprobaciones y comentarios. Esta preparación deja contratos y puertos.

## Para la entrevista
"Cada gasto compartido guarda su reparto en céntimos, así que el balance de cada miembro es simplemente lo pagado menos lo que le toca, y la suma del hogar es siempre cero (lo compruebo en los tests). Para saldar uso un voraz: el mayor deudor paga al mayor acreedor hasta que todos quedan en cero, como mucho n−1 pagos. El óptimo exacto es NP-difícil y no compensa para un hogar. Y los gastos que añade otro no cuentan hasta que los apruebas, para que tu saldo nunca cambie a tus espaldas."

Analogía: Splitwise / Tricount. La función "simplificar deudas" de Splitwise es exactamente este problema.

Preguntas probables:
- *¿Por qué no el óptimo?* Es un problema de partición de subconjuntos de suma cero (NP-difícil). Con 4 miembros la diferencia es, como mucho, una transferencia.
- *¿Y los céntimos que no se reparten exactos?* Se resuelven al crear el movimiento (el sobrante va al pagador). Después todo son sumas de enteros.
- *¿Qué pasa si alguien no aprueba nunca?* El gasto queda fuera del balance y la UI lo recuerda. Recordatorio *push* "tienes gastos por revisar".
