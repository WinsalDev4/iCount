# ADR-0007: Representar el dinero en unidades menores enteras (`Money`)

- **Estado:** Aceptado
- **Fecha:** 2026-10-13

## Contexto
En JavaScript `0.1 + 0.2 === 0.30000000000000004`. En una app financiera, sumar cientos de gastos en `number` decimal acumula errores de redondeo visibles.

## Opciones consideradas
1. `number` con decimales — inaceptable.
2. Librería decimal (`decimal.js`, `dinero.js`) — correcto, pero peso extra y API ajena al dominio.
3. **Enteros en unidades menores** (céntimos) dentro de un *value object* propio.
4. `bigint` — sin límite, pero no serializa a JSON y es más incómodo; innecesario para importes personales.

## Decisión
Value object `Money` (`mobile/src/core/domain/Money.ts`): `amountMinor` entero (`Number.isSafeInteger`) + `currency`. Inmutable. Operaciones `plus`/`minus` que fallan si se mezclan divisas. Formateo con `Intl.NumberFormat`.

## Por qué
- Aritmética entera exacta hasta 2⁵³ céntimos (~90 billones €), más que suficiente.
- Hace imposible por diseño sumar EUR con USD.
- En backend: columna `BIGINT` (céntimos) o `NUMERIC(19,4)` en PostgreSQL, y la API envía enteros.

## Consecuencias
- Las conversiones de entrada (teclado "12,50") → `1250` se hacen en un único parser con tests.
- Divisas sin decimales (JPY) o con 3 (KWD) requerirán un mapa de exponentes cuando se soporten.

## Para la entrevista
"Nunca uso flotantes para dinero: modelo un value object con enteros en la unidad mínima y la divisa, inmutable y con invariantes en el constructor. Es el mismo patrón que `BigDecimal`/`Money` en Kotlin o `Decimal` en Swift, adaptado a que JS solo tiene IEEE-754."
