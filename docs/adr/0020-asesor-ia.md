# ADR-0020: Asesor financiero con Claude (solo backend, números deterministas)

- **Estado:** Aceptado
- **Fecha:** 2026-10-14

## Contexto
La fase 7 añade un asesor que detecta ahorros, propone planes que se aplican con un toque y responde preguntas sobre las finanzas del hogar. Riesgos propios del dominio:
- **Números inventados**: un modelo de lenguaje puede escribir "ahorrarías 312 €" sin base. En una app de dinero eso es inaceptable.
- **Privacidad**: los movimientos describen la vida de las personas (salud, ocio, a quién se paga).
- **Coste**: cada mensaje de chat consume tokens, y un usuario o un bucle podrían disparar la factura.
- **Seguridad**: la clave de la API no puede vivir en un binario que cualquiera puede descompilar.

## Opciones consideradas
1. **Llamar al modelo desde la app**: expone la clave. Descartado.
2. **El modelo calcula y redacta** (le das los movimientos y que "analice"): sencillo, pero las cifras no son fiables ni auditables.
3. **Código determinista calcula, el modelo prioriza y explica** ← elegida.

## Decisión

### Arquitectura
- **Solo el backend llama a la API de Claude** con `@anthropic-ai/sdk`. La clave (`ANTHROPIC_API_KEY`) vive en el entorno del servidor y se valida con zod al arrancar. La app habla con la API de iCount (`AdvisorRepository` → `/v1/.../advisor/*`).
- **Detectores deterministas** (SQL + `@icount/finance`): suscripciones duplicadas, presupuestos superados, deudas caras (tipo alto o amortización anticipada rentable) y gasto anómalo por categoría frente a la media de los meses anteriores. Producen hallazgos con su **evidencia numérica**.
- **El modelo** recibe esos hallazgos ya calculados y los **prioriza y redacta**, con salida estructurada validada con zod. Los **planes** (ahorro o salida de deudas) los genera `@icount/finance`; el modelo solo los explica.
- **Chat** con *tool use* sobre **agregados** del hogar (resumen mensual, presupuestos, deudas, simulación de pago extra con `@icount/finance`) y *streaming* al cliente por **SSE** (`chatStreamEventSchema`).

### Modelo y parámetros (consultados en la documentación vigente, skill `claude-api`)
- **`claude-opus-5-5`** para ambas rutas, con **pensamiento adaptativo** (en este modelo no se puede desactivar) y `output_config.effort` ajustado por ruta: `medium` (el valor por defecto en Opus 5.5) para redactar hallazgos y `low` para el chat conversacional. Se mide sobre el set de evaluación antes de cambiarlo. Bajar de modelo por coste es una decisión explícita posterior, no un supuesto de diseño.
- **Salida estructurada**: `client.messages.parse()` con `output_config.format = zodOutputFormat(schema)` (`@anthropic-ai/sdk/helpers/zod`). Si `parsed_output` es nulo o la validación falla, el hallazgo se muestra con el texto por defecto del detector, sin redacción del modelo.
- **Herramientas**: definidas con `strict: true` y `tool_choice: auto`, porque Opus 5.5 rechaza `any`/`tool` forzados. Con *streaming* y herramientas propias, `eager_input_streaming: true`, validando cada entrada contra su esquema zod antes de ejecutarla.
- **Streaming**: `client.messages.stream()`. Los `text_delta` se reenvían como eventos SSE `delta` y al final se usa `finalMessage()` para el uso de tokens y el `stop_reason`.
- **Rechazos**: se comprueba `stop_reason === "refusal"` antes de leer el contenido y se activa el *fallback* del servidor (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). Un rechazo final se convierte en un evento `error` con *problem details*.
- **Prompt caching**: el *system prompt* (rol, reglas de estilo y de cifras) y la lista de herramientas son **estables y van primero**, con `cache_control`. Los datos del hogar van después. Se vigila `usage.cache_read_input_tokens`.

### Regla de oro: el modelo no inventa cifras
- El *prompt* lo prohíbe expresamente y le da todas las cifras ya formateadas.
- **Validación posterior**: cada importe o porcentaje que aparece en el texto generado debe estar en el conjunto de cifras proporcionadas. Si no está, el texto se descarta y se usa la redacción por defecto del detector.
- Un **set de evaluación** con hogares ficticios ejecuta esa comprobación en CI (A-7.1).

### Privacidad y consentimiento
- **Consentimiento explícito y versionado** (`advisorConsentDtoSchema`) antes de enviar nada. Revocarlo detiene el envío y borra conversaciones.
- Se envían **agregados** (totales por categoría y mes, nombres de categoría, deudas sin entidad bancaria), **no descripciones en bruto** de movimientos. Los miembros van **seudonimizados** ("Miembro A").
- Sin datos de identificación (emails, nombres reales) en los *prompts*. Las conversaciones se guardan 30 días y el usuario puede borrarlas.

### Costes
- **Cuota por usuario y día** (p. ej. 20 mensajes de chat); el evento `done` informa de lo que queda.
- Los **hallazgos se calculan una vez al día por hogar** en una **cola de trabajos** (`@nestjs/schedule`, ya instalado) y se cachean. Se invalidan si cambian los datos relevantes.
- *Prompt caching* para la parte estable. `max_tokens` acotado por ruta y *streaming* para respuestas largas.

## Por qué
- Separar **cálculo** (determinista, testeado, igual en app y servidor) de **lenguaje** (modelo) da lo mejor de los dos: cifras auditables y explicaciones naturales.
- La clave en el servidor y los datos agregados minimizan el riesgo de seguridad y el impacto en la privacidad.
- Las cuotas, la caché y la cola convierten un coste variable en uno acotado y predecible.

## Consecuencias
- Dependencia nueva en el backend: `@anthropic-ai/sdk`. Variable de entorno nueva `ANTHROPIC_API_KEY` (opcional en desarrollo: sin ella el asesor responde con la redacción por defecto de los detectores y el chat devuelve 503 con *problem details*).
- Contratos en `@icount/contracts` (`advisor.ts`): `Insight`, `Plan`, eventos SSE del chat, acciones aplicables y consentimiento. Puerto `AdvisorRepository` en la app (con `AsyncIterable` para el *streaming*).
- "Aplicar" un plan en la app **reutiliza los casos de uso existentes** (presupuestos, pago extra de deudas, cancelar un recurrente). El backend solo registra qué se aplicó, para evaluar el asesor.
- Riesgo de deriva del modelo o de la API: las salidas estructuradas y la validación de cifras degradan con elegancia a los textos por defecto.

## Para la entrevista
"La IA nunca calcula: los ahorros, los planes y las simulaciones salen de código determinista y testeado, compartido con la app. El modelo prioriza y explica con salida estructurada validada con zod, y descarto cualquier texto que contenga una cifra que no le di. Solo el backend llama a Claude, con datos agregados y seudonimizados, tras un consentimiento versionado. El chat va por SSE con *tool use* sobre agregados, y el coste está acotado con cuotas por usuario, *prompt caching* y una cola diaria para los hallazgos."

Analogía Android/iOS: es como no confiar en un servicio remoto para algo crítico. La lógica de dinero vive en tu módulo de dominio y el servicio solo aporta presentación.

Preguntas probables:
- *¿Cómo sabes que no alucina cifras?* Extraigo los números del texto y compruebo que están en los datos que le pasé. Hay un test de evaluación que falla si no.
- *¿Por qué no enviar los movimientos tal cual?* Privacidad (descripciones sensibles) y coste (tokens). Los agregados bastan para aconsejar.
- *¿Por qué SSE y no WebSocket?* La comunicación es de servidor a cliente, una respuesta por petición. SSE va sobre HTTP normal, atraviesa *proxies* y no necesita estado de conexión.
