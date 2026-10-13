# G · Preparación global de las fases 3 a 7

**Objetivo:** que las pistas A y B puedan trabajar en paralelo hasta el final de sus roadmaps sin esperar a una `X.0` por fase. Opus hace de una vez todas las preparaciones (dependencias, contratos, puertos, módulos stub y ADRs de arquitectura). Reglas del modo: [PROTOCOLO.md](PROTOCOLO.md#modo-de-preparación-global).

> Cada bloque de G.0 cubre exactamente lo que dice el apartado "Hecho cuando" de la `X.0` de su fase en su fichero (`fase-3-movimientos.md`, etc.). Aquí solo se añaden el orden, el reparto en PR y lo que queda fuera.

---

## [x] G.0 · Preparación global — Opus, en solitario
- **Rama:** un PR por bloque: `feature/g.0-fase-3`, `feature/g.0-fase-4`, `feature/g.0-fase-5`, `feature/g.0-fase-7`, `feature/g.0-fase-6-tecnica` · **Depende de:** `2.0` ✅ (no de la `2.9`: la fase 2 se integra aparte)
- **Orden y desbloqueos** (cada PR se fusiona antes de empezar el siguiente):
  1. **Fase 3** → ADR-0014, dependencias (`react-native-mmkv`, persistencia de TanStack Query, `@shopify/flash-list`), contratos de transacciones/categorías/resúmenes, puertos ampliados. Marca `3.0` `[x]`. *Desbloquea B-3.1, B-3.2, B-3.3.*
  2. **Fase 4** → ADR-0015, esqueleto de `@icount/finance`, dependencias (`@nestjs/schedule`, `expo-notifications`), contratos de presupuestos/deudas/recurrentes, puertos y módulos stub. Marca `4.0` `[x]`. *Desbloquea B-4.1 y B-4.3; B-4.2 sigue necesitando A-4.1.*
  3. **Fase 5** → ADR-0016 y ADR-0017, dependencias (`expo-server-sdk`, `expo-device`), contratos de balances/liquidaciones/actividad/push, puertos y módulos stub. Marca `5.0` `[x]`. *Desbloquea B-5.1 a B-5.3.*
  4. **Fase 7** → ADR-0020, `@anthropic-ai/sdk` en el backend, contratos de `Insight`/plan/chat, `AdvisorRepository` y módulo stub. Marca `7.0` `[x]`. *Desbloquea B-7.1.*
  5. **Fase 6 (parte técnica)** → dependencias que no necesitan decisión del usuario (`expo-localization`, librería de i18n, `helmet`) y, si la doc de SDK 57 lo exige, plugins de `app.json`. **No** incluye `eas init`, ADR-0018, ADR-0019 ni `EXPO_PUBLIC_API_URL` por perfil: siguen en la `6.0`. Marca en la `6.0` solo las viñetas cumplidas. *Desbloquea B-6.1 y B-6.2 cuando se complete también la `6.0`.*
- **Hecho cuando:**
  - Los cinco bloques están fusionados en `develop` y cada `X.0` cubierta está `[x]` (la `6.0` queda parcial y se anota).
  - `npm install` en la raíz sigue instalando todo y `npm run verify` está en verde tras cada bloque.
  - Ningún puerto nuevo lanza errores al componerse el contenedor: los módulos stub usan `notImplemented` como en la `2.0`.
  - `docs/plan/README.md`: estado de cada fase coherente (la fase en curso 🚧, las demás ⏳) y G.0 anotada.
  - Cada contrato y puerto tiene su test mínimo (esquema zod válido e inválido; el contenedor compone sin lanzar).
- **Riesgo conocido:** se definen puertos de fases lejanas con menos información. Mitigación: son interfaces pequeñas, los cambios no aditivos se corrigen con un PR `fix(ports)` (ver reglas del modo) y la `X.9` de cada fase revisa los puertos antes de conectar la API.
- **Prompt:**
```
Tarea G.0 de iCount (sigue docs/plan/PROTOCOLO.md, sección "Modo de preparación global"; pista A, Opus).
Ejecuta de una vez las preparaciones de las fases 3, 4, 5 y 7 y la parte técnica de la 6, en este orden y con un PR por fase (fusiona cada uno al estar en verde, para desbloquear a la pista B cuanto antes): 3, 4, 5, 7, 6.
Para cada fase lee SOLO su sección "X.0" en docs/plan/fase-X-*.md y haz exactamente su "Hecho cuando": ADRs con su número, dependencias (npx expo install en mobile; consulta la doc versionada de SDK 57 y la de cada paquete, no la memoria), contratos zod en packages/contracts, puertos de dominio en la app (TS puro) y módulos stub con notImplemented registrados en core/di/container.ts. No implementes casos de uso, pantallas ni endpoints.
De la 6.0 NO hagas eas init, ADR-0018, ADR-0019 ni los perfiles de eas.json: déjalos pendientes en la 6.0 y anota qué viñetas quedan.
Tras cada PR: casilla X.0 marcada y estado en docs/plan/README.md. Verifica con npm run verify. Al terminar, marca G.0 [x] en este fichero.
```
