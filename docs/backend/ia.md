# Asesor financiero con IA (backend)

Decisión: [ADR-0020](../adr/0020-asesor-ia.md). Código en `backend/src/modules/advisor`. Contratos en `@icount/contracts/advisor.ts`. En la app, `ApiAdvisorRepository` y el cliente SSE están en `mobile/src/features/advisor/data/api`.

**Principio:** la IA nunca calcula. Las cifras salen de código determinista (SQL y `@icount/finance`). Claude solo **prioriza, redacta y conversa**, y cualquier texto suyo con una cifra que no le dimos se descarta.

## Endpoints

| Método y ruta | Qué hace |
|---|---|
| `GET / PUT /v1/me/advisor/consent` | Consentimiento **versionado** (versión actual: 1). Revocarlo borra las conversaciones |
| `GET /v1/households/:id/advisor/insights` | Hallazgos priorizados con evidencias, ahorro potencial y acciones de un toque |
| `POST /v1/households/:id/advisor/chat` | Chat por **SSE** (`text/event-stream`): eventos `delta`, `plan` y uno final `done` o `error` |
| `POST /v1/households/:id/advisor/applied` | Registra qué acción aplicó el usuario (señal de evaluación) |

## Cómo se construye un hallazgo

```
repositorios ──▶ HouseholdSnapshot (solo agregados) ──▶ detectores ──▶ Finding[]
                                                            │  (cifras, acciones, texto por defecto)
                         ¿consentimiento y modelo? ──sí──▶ Claude prioriza y redacta (salida estructurada)
                                                            │
                                     guardián de cifras ◀───┘  cifra inventada → texto por defecto
                                                            ▼
                                 informe en caché (huella de los hallazgos + día)
```

- **`HouseholdSnapshot`**: totales por categoría y mes (el actual y los 4 anteriores), presupuestos del mes con lo gastado, recurrentes activos y deudas con su saldo de hoy. **No incluye** descripciones de movimientos, emails ni nombres de personas.
- **Detectores** (`domain/findings.ts`, funciones puras):

| Detector | Regla | Acción propuesta |
|---|---|---|
| Suscripciones duplicadas | Suscripciones con el mismo servicio ("Netflix Premium" / "Netflix Básico"). Las anuales cuentan 1/12 al mes | Cancelar las más baratas; te quedas con la más completa |
| Presupuesto superado | Gastado > límite este mes | — |
| Deuda cara | TIN ≥ 10 %. Se simula un pago extra (10 % de la cuota, redondeado a 10 €) con `simulateExtraPayment` | Pago extra mensual |
| Gasto inusual | El mes pasado ≥ 1,5 × la media de los 3 anteriores **y** al menos 50 € más | Presupuesto igual a la media |

## El guardián de cifras (la regla de oro)
`domain/figures.ts` extrae del texto cada número escrito en formato español (`1.234,56`, `12,3 %`, `3`) y lo compara **como número** con las cifras de los hallazgos (evidencias, ahorros, hechos como "21,9 %" o "3 meses"). `1.234,5` y `1 234,50` son la misma cifra. Pero `7` en lugar de `6,99`, o `83,88 €` al año calculado por el modelo, son cifras **inventadas**, y el texto se sustituye por el del detector. También se descartan claves desconocidas y textos demasiado largos.

## Claude (`infrastructure/claude-advisor-model.ts`)
Configuración consultada en la referencia vigente (skill `claude-api`):
- **Modelo `claude-opus-5-5`**. El pensamiento adaptativo viene activado por defecto en este modelo (no se puede desactivar), así que solo se ajusta `output_config.effort`: **`medium`** para redactar hallazgos y **`low`** para el chat conversacional.
- **Salida estructurada**: `client.beta.messages.parse()` con `betaZodOutputFormat(esquema)`. Si `parsed_output` no valida, hay `refusal`/`max_tokens` o la API falla, se devuelve `null` y se usan los textos por defecto.
- **Rechazos**: `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) reintenta en otro modelo según la categoría. Se comprueba `stop_reason === "refusal"` antes de leer el contenido.
- **Chat**: bucle manual con `client.beta.messages.stream()` (hasta 6 rondas). Las herramientas son `strict: true` y usan `eager_input_streaming: true`, así que **cada entrada se valida con zod antes de ejecutarse**; una entrada inválida vuelve como `tool_result` con `is_error`. `tool_choice` queda en `auto`, porque Opus 5.5 rechaza `any`/`tool`.
- **Historial *append-only***: dentro de un turno, la respuesta del asistente se reenvía tal cual (con sus bloques de pensamiento) seguida de los resultados. `system` y `tools` son idénticos byte a byte en todas las peticiones. Esto lo exige el *preserved thinking* de Opus 5.5 y además mantiene la caché. Entre turnos solo se reenvía el texto.
- **Prompt caching**: el *system prompt* (rol, estilo, reglas de cifras) y las herramientas van primero, con `cache_control`. Los datos del hogar van después, en el mensaje del usuario. El uso (`cache_read_input_tokens`) se registra en el log.

### Herramientas del chat (`application/chat-tools.ts`)
`get_month_spending`, `get_budgets`, `get_debts` (las deudas se identifican como `D1`, `D2`…, sin ids internos), `get_insights`, `simulate_extra_debt_payment` y `propose_savings_plan`. Las dos últimas calculan con `@icount/finance` y además envían una **tarjeta de plan** (evento `plan`) con acciones de un toque. Todos los importes salen ya formateados, para que el modelo los copie en lugar de calcularlos.

## Costes y privacidad
- **Consentimiento**: sin él, los hallazgos se calculan igual, pero **no se envía nada al modelo**. El chat responde 403 (`advisor-consent-required`).
- **Cuota**: 20 mensajes por usuario y día (`ADVISOR_DAILY_CHAT_QUOTA`), contados desde el inicio del día en Madrid (`startOfDayIn`, con cambio de hora). Pasarse responde 429, y el evento `done` informa de lo que queda.
- **Caché de hallazgos**: el informe se guarda con una huella de los hallazgos y del día. Si los datos no cambian, no se vuelve a llamar al modelo. Una tarea diaria (06:00) lo regenera para los hogares con consentimiento y borra las conversaciones con más de 30 días.
- **Sin clave** (`ANTHROPIC_API_KEY` sin definir): los hallazgos usan el texto por defecto y el chat responde 503 (`advisor-unavailable`). La clave solo vive en el servidor.

## SSE
El controlador valida todo lo que puede fallar (consentimiento, cuota, modelo, propiedad de la conversación) **antes** de abrir el *stream*, así esos errores son respuestas *problem+json* normales. Después escribe `data: <json>\n\n` validado con `chatStreamEventSchema`. Si la app cierra la conexión, un `AbortController` corta la llamada al modelo. Un fallo a mitad se convierte en un evento `error` con *problem details*.

En la app, `sseData` separa los eventos **por bytes** antes de decodificar: el `TextDecoder` nativo de Expo no admite decodificación incremental, y un `€` partido entre dos trozos de red se corrompería.

## Evaluación
- **Offline, en CI** (`src/modules/advisor/eval/advisor.eval.spec.ts`): tres hogares ficticios (`eval/fixtures.ts`). Se comprueba que los textos por defecto solo contienen cifras de los datos, que una respuesta fiel grabada se muestra tal cual y que **una respuesta con cualquier cifra inventada** (redondeos, cálculos anuales, porcentajes) nunca llega al usuario.
- **En vivo** (`npm run eval:advisor -w @icount/backend`): manda los mismos hogares al modelo real, cuenta cuántas redacciones descartó el guardián y falla si alguna cifra inventada llegara a mostrarse. **Cuesta dinero**: necesita `ANTHROPIC_API_KEY` y no se ejecuta en CI.
- **Unitarios**: detectores, guardián, herramientas (simulaciones idénticas a `@icount/finance`) y el adaptador de Claude con el **SDK simulado**. Este último comprueba el modelo, el *effort*, el *fallback*, las herramientas *strict*, el historial *append-only*, que `system`/`tools` no cambian entre rondas y que no salen ids internos.
- **E2E** (`test/advisor.e2e-spec.ts`, con un `AdvisorModel` falso): consentimiento, hallazgos sin modelo, redacción con caché, guardián, SSE (`delta`, `plan`, `done`), conversación, cuota, revocación y acciones aplicadas.

## Para la entrevista

**En 30 segundos:** "El asesor separa cálculo y lenguaje. Unos detectores deterministas encuentran suscripciones duplicadas, presupuestos superados, deudas caras y gasto inusual, con sus cifras. Claude solo los prioriza y redacta con salida estructurada validada con zod, y un guardián descarta cualquier texto con un número que no esté en los datos. El chat va por SSE con herramientas *strict* sobre agregados del hogar, y los planes los calcula el mismo motor financiero que la app. Todo tras un consentimiento versionado, con cuota diaria, caché de *prompt* y de hallazgos, y una evaluación que falla si el modelo inventa una cifra."

Preguntas probables:
- *¿Cómo detectas una cifra inventada?* Extraigo los números del texto, los normalizo (formato español) y compruebo que estén en el conjunto de cifras que le di. Es conservador: si redondea `6,99` a `7`, también se descarta.
- *¿Por qué no dejar que el modelo calcule el ahorro?* Porque no es auditable ni reproducible. Las cifras de dinero salen de funciones puras testeadas, las mismas que usa la app sin conexión.
- *¿Qué pasa si Claude falla o rechaza?* Se degrada con elegancia: los hallazgos se muestran con el texto de los detectores, y el chat devuelve un evento `error` con *problem details*. Antes, el *fallback* del servidor intenta otro modelo.
- *¿Por qué SSE y no WebSocket?* El flujo es de servidor a cliente, una respuesta por pregunta. SSE va sobre HTTP normal (autenticación, *proxies*, reintentos) y no necesita estado de conexión.
- *¿Cómo controlas el coste?* Cuota por usuario y día, caché de hallazgos por huella (una llamada al día si nada cambia), *prompt caching* del prefijo estable, *effort* `low` en el chat y `max_tokens` acotado.
