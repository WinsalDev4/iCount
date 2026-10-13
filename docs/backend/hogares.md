# Hogares (backend)

Un **hogar** agrupa a quienes comparten economía: una persona sola (`personal`) o una pareja, familia o piso (`shared`). Código en `backend/src/modules/households`; contratos en `@icount/contracts` (`household.ts`).

## Endpoints (todos autenticados)

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /v1/households` `{ name, kind, currency? }` | Cualquiera | Crea el hogar; el creador es **admin** y el reparto empieza a partes iguales |
| `GET /v1/households` | Cualquiera | Mis hogares (los que soy miembro) |
| `GET /v1/households/:id` | Miembros | Detalle con miembros, rol e ingresos |
| `POST /v1/households/:id/invitations` | Admin, hogar compartido | Código de 8 caracteres, 48 h, un solo uso |
| `POST /v1/households/join` `{ code }` | Cualquiera | Entra como `member` |
| `PUT /v1/households/:id/split-rule` `{ splitRule }` | Admin | `equal`, `income-proportional` o `custom` por categoría |
| `PUT /v1/households/:id/members/me/income` `{ monthlyIncome }` | Miembros | Mi ingreso mensual declarado (para el reparto proporcional) |

Errores (RFC 9457): `household-not-found` (404), `not-household-admin` (403), `personal-household` (422), `invalid-invite` (404), `expired-invite` (422), `already-member` (409), `invalid-split-rule` (422) y `currency-mismatch` (422).

## Autorización por pertenencia
Cada caso de uso carga el hogar con `loadForMember`: si no existe **o no eres miembro**, responde **404**, no 403. Así no se revela que un id existe, ni se pueden probar ids de otros hogares. Los permisos de rol (solo admin) se comprueban después, ya dentro del hogar, y sí devuelven 403.

## El agregado `Household`
Todas las reglas viven en la entidad, no en los controladores:
- `addMember`: nunca en un hogar personal y nunca dos veces la misma persona.
- `setSplitRule`: solo admins. En `custom`, cada categoría una vez, cada miembro una vez por categoría, solo miembros del hogar y **puntos básicos que suman exactamente 10 000** (100 %, enteros).
- `setMemberIncome`: en la divisa del hogar, en céntimos.

El contrato ya valida la forma (enteros, rangos, sumas). El dominio vuelve a validar lo que depende del estado (quién es miembro), que el contrato no puede saber.

## Invitaciones
- Código de 8 caracteres de un alfabeto sin confusiones (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`: sin 0/O ni 1/I/L), generado con `crypto.randomInt`. Son 30⁸ ≈ 6,5·10¹¹ combinaciones. Si coincide con uno existente (índice único), se reintenta.
- El contrato **normaliza** lo que escribe la gente: `abcd-2345` → `ABCD2345`.
- **Unirse es atómico**: consumir el código y añadir al miembro van en la misma transacción (`TransactionRunner`). Además, `markUsed` es un `UPDATE … WHERE used_at IS NULL`: si dos personas usan el mismo código a la vez, solo una entra (probado en e2e).

## Unidad de trabajo (`TransactionRunner`)
`shared/database/database-context.ts` guarda la transacción abierta en `AsyncLocalStorage`. Los repositorios piden `context.db` y se unen a la transacción en curso sin recibir un parámetro `tx`. Los casos de uso solo ven el puerto `TransactionRunner.run(...)`. Es el equivalente de `@Transactional` + `TransactionSynchronizationManager` de Spring (que usa un `ThreadLocal`). Las llamadas anidadas se unen a la transacción exterior.

## Modelo de datos
- `households`: `split_rule` en **JSONB**. Se lee y escribe siempre entero, es pequeño y su forma la garantiza el contrato. Tres tablas normalizadas no aportarían nada.
- `household_members`: PK `(household_id, user_id)` e índice por `user_id` para "mis hogares". `monthly_income_minor` en `BIGINT` (céntimos).
- `household_invitations`: `code` único, `used_at` / `used_by`. FK con `ON DELETE CASCADE` desde el hogar.
- La lectura de hogares hace **dos consultas** (hogares + miembros con su usuario) en vez de N+1.

## Para la entrevista

**En 30 segundos:** "Los hogares son un agregado DDD: las reglas de quién entra, quién administra y cómo se reparte viven en la entidad. La autorización es por pertenencia y, para quien no es miembro, el hogar no existe (404, no 403). Las invitaciones usan códigos legibles sin caracteres ambiguos. Unirse consume el código y añade al miembro en una transacción, con un `UPDATE` condicional que hace imposible usar dos veces el mismo código aunque dos personas lo intenten a la vez."

Preguntas probables:
- *¿Por qué 404 y no 403?* Un 403 confirma que el recurso existe. Con ids adivinables (o filtrados) sería una fuga de información.
- *¿Cómo propagas la transacción sin pasar `tx` a todo?* Con `AsyncLocalStorage`, que es el `ThreadLocal` de Node: sobrevive a los `await` de la misma cadena asíncrona.
- *¿Por qué JSONB para la regla de reparto?* Es un valor (*value object*) que se lee y escribe completo, y que nunca se consulta por dentro. Si un día hiciera falta, por ejemplo, "qué hogares reparten la vivienda 60/40", se normalizaría.
