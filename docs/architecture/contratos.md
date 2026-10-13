# Contratos compartidos (`@icount/contracts`)

Un **contrato** es la forma exacta de lo que viaja por HTTP entre la app y la API. En iCount se escribe **una sola vez**, como esquemas **zod** en `packages/contracts`. De ellos se obtienen:

- el **tipo TypeScript** (`z.infer`), que usan el backend y la app;
- la **validación en ejecución**: el backend valida lo que recibe (`ZodValidationPipe`) y la app valida lo que recibe del backend (capa de red, A-1.3);
- la **documentación OpenAPI** del backend (`zodToOpenApi`).

Cómo se consume sin paso de build: [ADR-0011](../adr/0011-npm-workspaces-y-paquetes-compartidos.md).

> **Analogía Android/iOS:** es el módulo `:shared` de KMP con clases `@Serializable` que usan a la vez Ktor (servidor) y la app. O un paquete Swift con structs `Codable` compartido entre un servidor Vapor y la app. La diferencia: zod valida reglas (entero seguro, UUID, rango), no solo la forma.

## Qué hay

| Esquema | Tipo | Regla clave |
|---|---|---|
| `moneyDtoSchema` | `MoneyDto` | `amountMinor` **entero seguro** (céntimos, puede ser negativo) + `currency`. Nunca decimales ([ADR-0007](../adr/0007-dinero-en-unidades-menores.md)); es la forma serializada de `Money` en la app |
| `currencyCodeSchema` | `CurrencyCode` | `EUR`, `USD`, `GBP`, `MXN` (igual que `Money.ts`) |
| `userIdSchema`, `householdIdSchema`, `transactionIdSchema` | `UserId`, `HouseholdId`, `TransactionId` | UUID con **marca de tipo**: en ejecución son `string`, pero el compilador no deja pasar un `UserId` donde se espera un `HouseholdId` |
| `pageRequestSchema` | `PageRequest` | `cursor` opaco opcional + `limit` (1–100, por defecto 20; convierte el texto de la *query string*) |
| `pageSchema(item)` | `Page<Item>` | `{ items, nextCursor }`; `nextCursor: null` = última página |
| `problemDetailsSchema` | `ProblemDetails` | RFC 9457, tolerante: todo opcional, `type` por defecto `about:blank`, extensiones desconocidas conservadas |
| `categoryIdSchema` / `categoryIdResponseSchema` | `CategoryId` | Estricto al **enviar**; tolerante al **recibir** (una categoría desconocida se lee como `other`) |
| `API_VERSION` | `ApiVersion` | Versión mayor del contrato HTTP; el backend la usa como prefijo (`/v1`) |

### ¿Por qué paginación por cursor y no por página/offset?
Con `?page=3` y movimientos nuevos entrando arriba, la página 3 "se desplaza": verías elementos repetidos o te saltarías otros. El cursor apunta a un elemento concreto (p. ej. `occurredAt + id` codificados), así que el scroll infinito del historial es estable y la consulta usa el índice (`WHERE (occurred_at, id) < (…) LIMIT n`) en vez de un `OFFSET` que recorre filas. Para el cliente el cursor es **opaco**: lo devuelve tal cual, nunca lo construye. Así el servidor puede cambiar su formato.

### ¿Por qué *branded types*?
Casi todos los IDs son UUID. Un `deleteMember(householdId, userId)` con los argumentos cruzados compila sin problema si ambos son `string`. Con *brands* no compila. No hay coste en ejecución: la marca solo existe para el compilador (como una `value class` de Kotlin, que se borra al compilar).

## Reglas para escribir contratos
1. **Solo TypeScript borrable** (nada de `enum`, `namespace`…) e imports relativos con `.ts`. Para enumeraciones, `z.enum([...])`.
2. Todo lo público se exporta desde `src/index.ts`.
3. Un esquema por concepto. Los compuestos (`createTransactionRequestSchema`…) se construyen a partir de los básicos (`moneyDtoSchema`, `categoryIdSchema`…).
4. Los nombres siguen el patrón `<algo>Schema` para el esquema y `<Algo>` para el tipo inferido.
5. Cada esquema lleva tests de casos válidos **e inválidos**.

## Cómo evolucionar sin romper apps antiguas

La app móvil **no se actualiza a la vez que la API**: en las tiendas conviven versiones de hace meses. Por eso el contrato se trata como una API pública.

**Cambios compatibles** (se despliegan sin más):
- Añadir un **campo opcional** a una petición, o cualquier campo a una respuesta. La app antigua lo ignora: zod descarta las claves desconocidas al parsear objetos normales.
- Añadir un **endpoint** nuevo.
- Añadir un **valor a un enum de respuesta**, solo si la app lo lee de forma tolerante (`categoryIdResponseSchema` → `other`). Por eso hay dos esquemas de categoría.
- Relajar una validación de petición (aceptar más).

**Cambios incompatibles** (necesitan estrategia):
- Quitar o renombrar un campo, cambiar su tipo, hacer obligatorio uno opcional o endurecer una validación de petición.

Estrategia **expand → migrate → contract** (ampliar, migrar, recortar):
1. **Ampliar:** el backend acepta y devuelve el campo viejo **y** el nuevo.
2. **Migrar:** sale una versión de la app que usa el nuevo; se espera a que casi nadie use la antigua (métricas por versión; más adelante, versión mínima soportada).
3. **Recortar:** se elimina el campo viejo.

Si un cambio no cabe en ese patrón (otro modelo de recursos), se sube `API_VERSION`. `/v2` convive con `/v1` hasta retirar `/v1`, y los esquemas viejos se mantienen en el paquete con sufijo (`…V1Schema`) mientras exista esa versión.

**En la práctica**, cada PR que toca `packages/contracts` debe responder: *"¿una app de hace 6 meses sigue funcionando con este cambio?"* El CI ayuda: si un cambio rompe el uso en la app o en el backend, `tsc` falla en `mobile-ci` o en `backend-ci`, porque ambos se ejecutan cuando cambia `packages/**`.

## Para la entrevista

**En 30 segundos:** "App y API comparten un paquete de contratos con esquemas zod. De cada esquema salen el tipo TypeScript, la validación en ejecución en ambos extremos y el OpenAPI, así que no hay DTOs duplicados que se desincronicen. El dinero va en céntimos enteros, los IDs son *branded types* y los errores siguen RFC 9457. Para no romper apps antiguas en las tiendas, los cambios son aditivos, los enums se leen de forma tolerante y los cambios incompatibles siguen *expand-migrate-contract* o una versión nueva de la API."

Preguntas probables:
- *¿No acopla demasiado la app al backend?* Acopla al **contrato**, que es justo lo que ambos deben respetar. La app sigue teniendo su propio dominio (`Money`, entidades) y mapea DTO → dominio en la capa de datos. El contrato no se filtra a las vistas.
- *¿Por qué validar en el cliente lo que ya valida el servidor?* El cliente valida **respuestas**, no peticiones: un backend con un bug o un proxy que devuelve HTML se detectan en la frontera con un error tipado, en vez de un `undefined` que rompe una pantalla más tarde.
- *¿Por qué no OpenAPI → codegen?* Es la alternativa clásica y válida para clientes de otros lenguajes. Con TypeScript en ambos lados, compartir el código fuente evita un paso de generación y da validación en ejecución gratis. Si mañana hubiera un cliente nativo en Kotlin, se generaría desde el OpenAPI, que ya sale de estos esquemas.
- *¿Qué pasa si el backend añade una categoría?* Las apps nuevas la muestran. Las antiguas la leen como `other` gracias al lector tolerante, y no fallan.
