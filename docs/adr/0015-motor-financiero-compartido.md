# ADR-0015: Motor financiero compartido en `@icount/finance`

- **Estado:** Aceptado
- **Fecha:** 2026-10-14

## Contexto
La fase 4 introduce **deudas** (cuadro de amortización, saldo pendiente, simulador de pago extra y estrategias avalancha / bola de nieve) y **presupuestos**. Esos cálculos los necesitan dos sitios:
- La **app**, para simular **al instante y sin conexión**: los chips "+50 / +100 / +200 €/mes" del detalle de una deuda deben responder al tocar, sin ir a la red.
- La **API**, que es la **fuente de verdad**: saldos pendientes, fechas de fin y lo que se guarda.

Si cada lado implementa su fórmula, tarde o temprano la app dirá "acabas en marzo" y el servidor "en abril", por un céntimo de redondeo distinto. En una app de dinero eso destruye la confianza.

## Opciones consideradas
1. **Solo en el backend**: la app pide cada simulación a la API. Una fuente única, pero sin simulación *offline* y con latencia en cada toque de chip.
2. **Duplicado en app y backend**: rápido de empezar, pero diverge con el tiempo (dos suites de tests, dos redondeos).
3. **Paquete compartido de TypeScript puro** que importan ambos ← elegida.

## Decisión
`packages/finance` (`@icount/finance`): **funciones puras**, sin dependencias, sobre **céntimos enteros** ([ADR-0007](0007-dinero-en-unidades-menores.md)), consumido sin paso de build igual que los contratos ([ADR-0011](0011-npm-workspaces-y-paquetes-compartidos.md)). App y backend lo declaran como dependencia (`"@icount/finance": "*"`).

### Reglas de cálculo
- **Entradas y salidas en céntimos enteros** (`assertCents`) y **tipos en puntos básicos enteros** (6,90 % → `690`). Nunca porcentajes en coma flotante en la interfaz.
- **Tipo para calcular: TIN (nominal anual)**. El tipo mensual es `TIN / 12`. La TAE se guarda solo como dato informativo, porque incluye comisiones y capitalización, y no sirve para el cuadro.
- **Amortización francesa** (cuota constante): `cuota = P · i / (1 − (1 + i)^−n)`, con `i` el tipo mensual y `n` el número de cuotas. Si `i = 0`, `cuota = P / n`.
- **Redondeo: medio hacia fuera de cero** (`roundHalfAwayFromZero`, como el `REDONDEAR` de una hoja de cálculo y lo habitual en banca), aplicado **una vez por paso**:
  - el interés de cada periodo se redondea al céntimo;
  - la amortización de capital es `cuota − interés` (entero);
  - **la última cuota absorbe el residuo**, para que el saldo final sea exactamente 0 (si no, quedarían céntimos "fantasma" por la acumulación de redondeos).
- Los decimales solo existen **dentro** de una función (la potencia de la fórmula). Todo lo que se devuelve o se suma entre periodos es entero.
- **Estrategias**: *avalancha* (primero el tipo más alto; minimiza intereses) y *bola de nieve* (primero el saldo más pequeño; motiva antes). El extra mensual, y la cuota de cada deuda ya liquidada, pasan a la siguiente de la lista. En caso de empate se ordena por id, para que el resultado sea determinista.
- Pruebas **contra cuadros de referencia** calculados aparte (hoja de cálculo), incluido el caso del lienzo: coche de 8.640 € al 6,9 % con 320 €/mes y +100 €/mes.

### Reparto de responsabilidades
- El **backend** usa el motor para persistir y servir (`outstanding`, `endDate`, `/schedule`, `/strategy`).
- La **app** lo usa en los casos de uso de simulación (B-4.2). Los datos guardados siempre vienen del backend.
- La **fecha** de cada cuota la calcula el motor con aritmética de calendario sin zona horaria (`YYYY-MM-DD`, día de mes ajustado a fin de mes), como en los recurrentes.

## Por qué
- **Una sola implementación y una sola suite de tests** garantizan que app y servidor dan los mismos números, al céntimo.
- TypeScript puro y sin dependencias: se ejecuta igual en Hermes (app), Node (API) y Vitest, y es fácil de leer en una entrevista.
- Las reglas de redondeo explícitas y documentadas son lo que pregunta cualquiera que haya trabajado con dinero.

## Consecuencias
- `packages/finance` con Vitest (como `contracts`); el CI `packages-ci` (antes `contracts-ci`) valida ambos paquetes.
- Cambiar una fórmula afecta a app y backend a la vez: los tests de ambos lados se ejecutan en CI al tocar `packages/**`.
- Las simulaciones de la app son **orientativas**: si el banco aplica otra convención (días reales/365, comisiones), los datos del banco mandan. Se indicará en la UI.
- A-4.1 implementa el motor. En esta preparación solo existe la política de redondeo (`roundHalfAwayFromZero`, `assertCents`) con sus tests.

## Para la entrevista
"Los cálculos de deudas viven en un paquete de TypeScript puro que comparten la app y la API. La app simula al instante y sin conexión, el servidor persiste, y nunca discrepan porque es el mismo código con los mismos tests. Todo va en céntimos enteros y puntos básicos. El único sitio con decimales es dentro de la fórmula de la cuota. Redondeo medio-hacia-fuera una vez por periodo, y la última cuota absorbe el residuo para que el saldo acabe exactamente en cero."

Analogía Android/iOS: es un módulo **KMP `commonMain`** con la lógica de negocio que comparten la app Android, la iOS y el backend Ktor. Aquí el "multiplataforma" es TypeScript en Hermes y en Node.

Preguntas probables:
- *¿Por qué TIN y no TAE?* La TAE resume el coste total para comparar productos (incluye comisiones y capitalización). El cuadro francés se calcula con el tipo nominal.
- *¿Por qué no `decimal.js`?* Con céntimos enteros solo hay una operación con fracciones (la potencia de la cuota), y se redondea en el acto. Una librería de decimales añadiría peso sin cambiar el resultado.
- *¿Avalancha o bola de nieve?* Avalancha minimiza intereses (óptima matemáticamente). Bola de nieve da "victorias" antes y ayuda a sostener el hábito. La app muestra las dos con su coste para que decida el usuario.
