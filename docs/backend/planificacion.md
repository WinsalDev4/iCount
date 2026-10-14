# Presupuestos y pagos recurrentes (backend)

Código en `backend/src/modules/{budgets,recurring}`; contratos en `@icount/contracts` (`budget.ts`, `recurring.ts`); cálculo de fechas en `@icount/finance` (`recurrence.ts`).

## Presupuestos

| Método y ruta | Qué hace |
|---|---|
| `GET /v1/households/:id/budgets?month=YYYY-MM` | Presupuestos del mes con **gastado** y **restante** (negativo si se supera) |
| `POST /v1/households/:id/budgets` | Crea uno por categoría y mes (409 si ya existe) |
| `POST /v1/households/:id/budgets/move` | Mueve importe de un presupuesto a otro del mismo mes |
| `PATCH / DELETE /v1/budgets/:id` | Cambia el límite o lo borra |

- **El gastado se calcula al leer**, con una subconsulta correlacionada que suma los gastos de esa categoría en ese mes, apoyada en el índice `(household_id, occurred_on…)` de movimientos. Nunca se desincroniza: editar o borrar un gasto actualiza el presupuesto sin código extra. Si hubiera muchos presupuestos, se cambiaría por un `GROUP BY` o una vista materializada.
- **Restricción única** `(household_id, month, category_id)`: un presupuesto por categoría y mes.
- **Mover importe** es atómico (`TransactionRunner`): el total del mes no cambia y el origen nunca queda en 0 ni por debajo (`insufficient-amount`). Ambos presupuestos deben ser del mismo hogar y mes.
- Solo categorías de gasto (`expense` o `both`). Divisa, la del hogar.

> Bug evitado (lección para la entrevista): dentro de una subconsulta, Drizzle escribe las columnas **sin prefijo de tabla**, y `category_id = category_id` se comparaba consigo misma, así que cada presupuesto sumaba todos los gastos. Lo detectó el e2e. La subconsulta usa ahora alias y columnas cualificadas.

## Pagos recurrentes

| Método y ruta | Qué hace |
|---|---|
| `GET / POST /v1/households/:id/recurring` | Lista y crea facturas, letras, suscripciones, ingresos… |
| `GET /v1/households/:id/recurring/upcoming?from&to` | Próximos vencimientos en una ventana (calendario y recordatorios) |
| `PATCH / DELETE /v1/recurring/:id` | Edita (recalcula el próximo vencimiento) o borra (los movimientos ya creados se quedan) |

### Reglas de periodicidad (`@icount/finance`)
`{ unit: 'month' | 'year', interval, dayOfMonth, monthOfYear? }`:
- **mensual el día 31** → 31 ene, 28 feb, 31 mar, 30 abr… (ajuste a fin de mes y vuelta al día original);
- **cada N meses** (`interval`), por ejemplo trimestral;
- **anual** con `monthOfYear` (29 de febrero → 28 en años no bisiestos).

La serie se ancla en el mes de `startDate`. Al crear un recurrente con inicio pasado **no se rellenan fechas anteriores a hoy**: el primer vencimiento es el siguiente desde hoy. `endDate` corta la serie (y entonces `nextDueDate = null`).

Al estar en el paquete compartido, la app calcula los mismos vencimientos sin conexión (pista B, recordatorios locales).

### El trabajo diario (idempotente)
`MaterializeDueRecurringPayments`, lanzado por `@nestjs/schedule` cada día a las **05:00 hora de Madrid** (`@Cron('0 5 * * *', { timeZone: 'Europe/Madrid' })`):

```
para cada serie con next_due_date ≤ hoy:
  en una transacción:
    mientras next_due_date ≤ hoy:              ← se pone al día si el servidor estuvo caído
      ¿INSERT recurring_occurrences (serie, fecha) ON CONFLICT DO NOTHING?
        sí → crea el movimiento (con reparto si es compartido) y lo enlaza
        no → otra ejecución ya lo hizo: no se duplica
      avanza next_due_date
```

- **Idempotencia por clave primaria** `(recurring_payment_id, due_date)`: lanzarlo dos veces, o en dos servidores a la vez, no duplica movimientos. El e2e lo comprueba con dos ejecuciones concurrentes.
- La ocurrencia se **reserva** primero (sin movimiento) y se **enlaza** después, en la misma transacción. Así la FK hacia `transactions` nunca apunta a una fila que aún no existe.
- En tests el `ScheduleModule` no arranca (`NODE_ENV=test`) y el trabajo se invoca directamente con una fecha fija.
- "Hoy" se calcula en la zona del hogar (España de momento) con `Intl.DateTimeFormat('en-CA', { timeZone })`.

## Modelo de datos (migración `0005`)
- `budgets` con la restricción única.
- `recurring_payments`: `rule` en JSONB, fechas como `DATE`, índice por `next_due_date` (el trabajo diario) y por hogar. `debt_id` sin FK hasta que exista la tabla de deudas (A-4.3).
- `recurring_occurrences` con PK `(recurring_payment_id, due_date)` y FK `ON DELETE SET NULL` al movimiento.

## Para la entrevista

**En 30 segundos:** "Los presupuestos calculan el gasto al leer, así que no se desincronizan nunca. Los recurrentes usan reglas de calendario con ajuste a fin de mes, en un paquete compartido con la app. Un trabajo diario convierte los vencimientos en movimientos. Es idempotente gracias a una tabla de ocurrencias con clave `(serie, fecha)` dentro de la misma transacción: se puede relanzar, ejecutar en dos servidores o ponerse al día tras una caída sin duplicar nada."

Preguntas probables:
- *¿Por qué no un contador "último ejecutado"?* Porque no protege de dos ejecuciones concurrentes. La clave primaria sí: la base de datos garantiza la unicidad.
- *¿Qué pasa si el trabajo falla a mitad?* Cada serie va en su transacción: lo hecho queda hecho, y lo que falló se reintenta al día siguiente (o en la siguiente ejecución) sin duplicar.
- *¿Y si el usuario cambia la regla?* Se recalcula `next_due_date` desde hoy. Las ocurrencias pasadas siguen enlazadas a sus movimientos.
