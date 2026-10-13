# Motor financiero (`@icount/finance`)

Funciones **puras** sobre **céntimos enteros**, compartidas por la app (simulaciones al instante y sin conexión) y la API (fuente de verdad). Decisión: [ADR-0015](../adr/0015-motor-financiero-compartido.md). Código en `packages/finance/src`.

| Función | Para qué |
|---|---|
| `frenchInstallment(P, tinBps, n)` | Cuota constante de un préstamo |
| `amortizationSchedule({…})` | Cuadro de amortización mes a mes |
| `outstandingBalance(input, fecha)` | Lo que se debe en una fecha |
| `simulateExtraPayment(input, extra)` | "¿Y si pago X € más al mes?" (meses e intereses ahorrados) |
| `payoffPlan(deudas, estrategia, extra, fecha)` | Avalancha o bola de nieve para N deudas |
| `splitAmount({ importe, pagador, miembros, regla, categoría })` | Reparto de un gasto compartido según la `SplitRule` del hogar |
| `addMonths`, `parseLocalDate`… | Aritmética de calendario sin zona horaria |

## Convenciones
- **Dinero en céntimos enteros** (`assertCents` rechaza fracciones) y **tipos en puntos básicos** (6,90 % → `690`).
- **TIN** (nominal anual) para calcular, con tipo mensual `i = TIN / 12`. La TAE es informativa.
- **Fechas `YYYY-MM-DD`** sin hora ni zona. Las cuotas mantienen su **día ancla**: una cuota el 31 cae el 28 o 29 en febrero y vuelve al 31 en marzo.
- **Redondeo medio hacia fuera de cero**, una vez por paso (`roundHalfAwayFromZero`), como el `REDONDEAR` de las hojas de cálculo.

## Fórmulas

**Cuota francesa** (constante):

```
        P · i
A = ─────────────────        (si i = 0:  A = P / n)
     1 − (1 + i)^(−n)
```

Es el único sitio con decimales. El resultado se redondea al céntimo.

**Cuadro de amortización**, en cada periodo `k`:

```
interés_k   = redondear(saldo_{k−1} · i)
capital_k   = cuota − interés_k
saldo_k     = saldo_{k−1} − capital_k
```

La cuota redondeada no cuadra exactamente: 856,0748 € se convierte en 856,07 €, y al final quedarían unos céntimos. Por eso **la última cuota absorbe el residuo**: si el préstamo tiene plazo (`termMonths`), la cuota `n` paga `saldo + interés`. Si no, el último pago es `min(cuota, saldo + interés)`. Así el saldo acaba en **0 exacto**, nunca en −0,03 € ni en una cuota 13 de 5 céntimos.

**Invariantes** (comprobados en los tests): `Σ capital = P`, `saldo_final = 0`, `total pagado − total intereses = P`, y todos los valores son enteros.

**Pago extra**: el mismo cuadro con `cuota + extra`. `simulateExtraPayment` compara ambos cuadros y devuelve los meses ahorrados y los intereses ahorrados.

**Cuota que no cubre los intereses**: si `cuota ≤ interés`, la deuda nunca se acabaría. Se lanza `PaymentTooLowError` en vez de entrar en un bucle infinito. Además hay un tope de 1.200 periodos.

## Estrategias para varias deudas

Presupuesto mensual constante = **Σ cuotas mínimas + extra**. Cada mes:
1. Cada deuda viva genera su interés y recibe su cuota mínima.
2. Lo que sobra (el extra **más las cuotas de las deudas ya liquidadas**, el "efecto bola de nieve" o *rollover*) va a la deuda viva con más prioridad. Si la liquida, el resto pasa a la siguiente.

| Estrategia | Prioridad | Ventaja |
|---|---|---|
| **Avalancha** | Tipo más alto primero (empate: saldo menor y luego id) | Minimiza los intereses totales (óptima matemáticamente) |
| **Bola de nieve** | Saldo más pequeño primero (empate: tipo más alto y luego id) | Elimina deudas antes y motiva a seguir |

Los desempates por id hacen el resultado **determinista**: la app y el servidor dan siempre el mismo orden. Los tests comprueban que la avalancha nunca paga más intereses que la bola de nieve, y que con una sola deuda `payoffPlan` coincide al céntimo con `simulateExtraPayment`.

## Reparto de gastos compartidos (`splitAmount`)

Cada miembro recibe `⌊importe × peso / Σ pesos⌋` y **los céntimos que sobran van al pagador**, así que las partes suman exactamente el importe. El peso depende de la regla:
- `equal`: 1 para todos.
- `income-proportional`: el ingreso declarado. Si alguien no lo ha declarado, o el total es 0, se reparte a partes iguales en vez de cargarlo todo a uno.
- `custom`: los puntos básicos de esa categoría. Quien no aparece en la lista paga 0, y las categorías sin reparto propio van a partes iguales.

Se calcula con `BigInt`: `importe × ingreso` puede superar 2⁵³ aunque cada número por separado quepa. Lo usan el backend al guardar cada movimiento compartido y la app para la vista previa del reparto.

## Casos de referencia (tests)

| Caso | Resultado | Fuente |
|---|---|---|
| 10.000 € al 5 % a 12 meses | Cuota 856,07 €; 1.ª fila: interés 41,67 € y capital 814,40 €; última cuota 856,12 € | Tabla bancaria estándar / `PMT()` |
| Hipoteca de 200.000 € al 3 % a 30 años | Cuota 843,21 € | `PMT()` |
| **Coche del lienzo**: 8.640 € al 6,9 % pagando 320 €/mes | 30 cuotas, hasta abril de 2029; intereses 776,54 € | Forma cerrada `NPER` |
| … con +100 €/mes | 22 cuotas (8 meses menos) e intereses 581,71 € (**194,83 € menos**) | `NPER` |

## Para la entrevista

**En 30 segundos:** "El motor es TypeScript puro sobre céntimos enteros que comparten app y servidor, así que el simulador del móvil y el backend dan el mismo céntimo. Solo hay decimales dentro de la fórmula de la cuota. Redondeo el interés de cada mes una vez, y la última cuota absorbe el residuo para que el saldo acabe en cero exacto. Las estrategias simulan mes a mes con un presupuesto constante, de modo que lo que liberas al terminar una deuda pasa a la siguiente."

Preguntas probables:
- *¿Por qué no `number` con decimales y redondear al final?* Los errores de coma flotante se acumulan en 360 cuotas y el cuadro no cuadraría con el del banco. Redondear por periodo es lo que hacen los bancos.
- *¿Por qué la última cuota es distinta?* Porque la cuota publicada está redondeada. Ajustar la última es la convención bancaria y evita saldos negativos o cuotas fantasma.
- *¿Coincide con mi banco?* Con el método francés y el TIN, sí, al céntimo o casi. Si el banco usa días reales/365 o cobra comisiones, sus datos mandan. La app lo indica.
- *¿Cómo se prueba algo así?* Con valores de referencia externos (`PMT`, `NPER`, tablas bancarias), invariantes que deben cumplirse siempre y comparaciones cruzadas entre funciones.
