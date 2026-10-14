# Fase 7 · Asistente IA → release 1.1.0

**Objetivo:** un asesor que detecta ahorros, propone planes de ahorro o de salida de deudas que se aplican con un toque, y responde preguntas sobre tus finanzas. Pantallas del lienzo: 10-B como principal y 10-A para el chat.

**Principio:** los números se calculan con código determinista (`@icount/finance` y consultas SQL). El modelo **explica, prioriza y conversa**; nunca inventa cifras.

---

## [x] 7.0 · Preparación — Opus, en solitario
- **Rama:** `feature/7.0-preparacion-ia` · **Depende de:** fase 6 ✅
- **Hecho cuando:**
  - ADR-0020 (IA):
    - Claude API **solo desde el backend** (la clave nunca va en la app).
    - Modelo elegido consultando la documentación vigente.
    - Privacidad: se envían agregados y no descripciones en bruto, con consentimiento explícito.
    - Control de costes: *prompt caching*, cuotas por usuario y cola de trabajos.
    - Salidas estructuradas validadas con zod.
    - *Streaming* del chat por SSE.
  - Dependencias: backend `@anthropic-ai/sdk`.
  - Contratos de hallazgos (`Insight`), plan, mensajes de chat y acciones aplicables.
  - Puerto `AdvisorRepository` y módulo stub.
  - Fase 7 → 🚧.
- **Prompt:**
```
Tarea 7.0 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Prepara la fase 7 según docs/plan/fase-7-asistente-ia.md. Usa la skill claude-api para elegir modelo y patrones actuales (structured outputs, prompt caching, streaming, tool use). Escribe ADR-0020 (arquitectura, privacidad y consentimiento, costes, por qué los números los calcula el código y no el modelo), instala @anthropic-ai/sdk en backend, define contratos zod (Insight, Plan, ChatMessage, AppliedAction), el puerto AdvisorRepository y su módulo stub. Marca estados.
```

---

## Pista A · Opus

### [x] A-7.1 · Backend: asesor financiero
- **Rama:** `feature/a-7.1-asesor` · **Depende de:** 7.0
- **Ficheros exclusivos:** `backend/**`, `mobile/src/features/advisor/data/api/**`, `docs/backend/ia.md`
- **Hecho cuando:**
  - Detectores deterministas: suscripciones duplicadas, presupuestos superados, deudas caras y gasto anómalo por categoría.
  - El modelo prioriza y redacta los hallazgos (salida estructurada); el plan de deuda o ahorro sale de `@icount/finance`.
  - Chat con *tool use* sobre agregados del hogar y *streaming* SSE.
  - Cuotas de uso y caché.
  - Conjunto de evaluación con datos ficticios y comprobaciones automáticas de que no inventa cifras.
  - `ApiAdvisorRepository` en la app.
- **Prompt:**
```
Tarea A-7.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Implementa el módulo advisor según ADR-0020: detectores deterministas (suscripciones duplicadas, presupuestos superados, deuda cara, gasto anómalo), priorización/redacción con Claude en salida estructurada validada con zod, generador de planes con @icount/finance, chat con tool use sobre agregados del hogar con streaming SSE, cuotas por usuario y prompt caching. Crea un set de evaluación con fixtures y un test que falle si la respuesta contiene cifras no presentes en los datos. ApiAdvisorRepository en la app. docs/backend/ia.md.
```

---

## Pista B · Sonnet

### [ ] B-7.1 · Asistente (10-B) y chat (10-A)
- **Rama:** `feature/b-7.1-asistente` · **Depende de:** 7.0
- **Ficheros exclusivos:** `mobile/src/features/advisor/{domain/usecases,data/InMemory*,presentation}/**`, `mobile/src/features/advisor/advisor.module.ts`, `mobile/src/app/advisor/**`, `docs/features/asistente.md`
- **Hecho cuando:** pantalla de hallazgos con el ahorro potencial total y tarjetas accionables; chat con *streaming* de texto y tarjetas de plan; "aplicar plan" reutiliza los casos de uso existentes (presupuestos y pagos extra a deudas); pantalla de consentimiento; acceso desde Inicio; tests.
- **Prompt:**
```
Tarea B-7.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Implementa el asistente (pantalla 10, maquetación B "hallazgos" + chat de la maquetación A): consentimiento previo, ahorro potencial total y tarjetas accionables, chat con streaming de texto y tarjetas de plan, y "aplicar plan" reutilizando casos de uso existentes de budgets y debts. Acceso desde Inicio. InMemoryAdvisorRepository que simula streaming. Tests. docs/features/asistente.md.
```

---

## [ ] 7.9 · Integración y cierre — Opus, en solitario
- **Hecho cuando:** asistente en modo `api` con datos reales de prueba; evaluación en verde; coste por usuario medido y documentado; fase 7 → ✅; release `1.1.0`.
- **Prompt:**
```
Tarea 7.9 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Integra la fase 7 en modo api, ejecuta la evaluación, mide el coste por usuario/mes y documéntalo en docs/backend/ia.md, corrige, marca la fase 7 ✅ y publica la release 1.1.0.
```
