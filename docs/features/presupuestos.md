# Feature: Planificar y presupuestos

Tarea B-4.1 · Pantalla 07 del lienzo, maquetación **A · Barras** ([ADR-0009](../adr/0009-direccion-visual-midnight-glass.md))

## Qué hace
- **Pestaña Planificar**: un hub con la entrada a **Presupuestos** (activa) y a **Deudas** y **Recurrentes** (visibles como "Próximamente" hasta B-4.2 y B-4.3).
- **Presupuestos**: un límite por categoría y mes. Cada uno es una barra con lo gastado, el límite y lo que **queda** o cuánto **te has pasado**; la barra pasa a ámbar al 80 % y a rojo al excederse. Arriba, el total del mes, y los presupuestos ordenados de más a menos preocupante. Se navega entre meses (no al futuro).
- **Crear y editar** (solo el mes actual): se elige una categoría de gasto que aún no tenga presupuesto y un límite; al editar se cambia el límite o se **elimina** con confirmación.
- **Mover importe**: "me he pasado en comida, quita 50 € de ocio". Cambia los *límites*, no los gastos, y el total no varía.
- **Inicio** muestra ahora el bloque de presupuestos (los tres más urgentes, el restante total y un enlace a todos); si no hay presupuestos, o su consulta falla, el bloque simplemente no aparece.

**Analogía:** es la pantalla de "envelopes" de YNAB. Los presupuestos son una vista derivada de los movimientos: igual que un `Flow` combinado con `map`, `spent` nunca se guarda, se calcula a partir de los gastos.

## Cómo está construida

```
mobile/src/features/budgets/
├── domain/
│   ├── budgetProgress.ts        budgetProgress / summarizeBudgets / sortByUrgency (puro)
│   └── usecases/BudgetUseCases.ts   ListBudgets · CreateBudget · UpdateBudgetLimit · DeleteBudget · MoveBudgetAmount
├── data/InMemoryBudgetRepository.ts
├── presentation/
│   ├── use{Budgets,BudgetForm,MoveBudget}ViewModel.ts
│   ├── {Budgets,BudgetForm,MoveBudget,PlanHub}Screen.tsx · BudgetBar.tsx
│   └── budgetMessages.ts
└── budgets.module.ts
mobile/src/features/transactions/data/sharedMemoryRepository.ts   un único almacén de movimientos en memoria
mobile/src/app/budgets/{_layout,index,edit,move}.tsx · app/(tabs)/plan.tsx
```

## Decisiones y por qué
- **`spent` se deriva, no se guarda** (en memoria igual que en la API): se suma el gasto de la categoría en el mes cada vez. Así añadir, editar o borrar un movimiento mueve las barras sin sincronizar nada; por eso los ViewModels de añadir y de detalle invalidan también `budgets.all(hogar)`.
- **Un único almacén de movimientos en memoria** (`sharedMemoryRepository`): sin servidor no hay base de datos común, y si el repositorio de presupuestos creara el suyo vería otros movimientos. Es un singleton con reinicio para los tests; con la API real no se usa.
- **Estados con umbrales exactos y en céntimos enteros**: `warning` desde el 80 % (7.999 sobre 10.000 sigue "ok"), gastar justo el límite es lleno pero **no** excedido, un céntimo más ya sí; el porcentaje se redondea hacia abajo (99,9 % nunca se muestra 100 %) y la barra se queda en 1 aunque se gaste el 250 %.
- **Mover importe respeta lo gastado**: el origen conserva al menos lo que ya gastó y al menos un céntimo de límite (`insufficient-amount` si no); el total de límites no cambia nunca. La pantalla calcula el máximo y muestra una vista previa "antes → después" para los dos presupuestos.
- **Solo se editan los presupuestos del mes en curso**: los de meses pasados son un registro, y se ven sin botones.
- **Una categoría, un presupuesto por mes**: crear ofrece solo categorías de gasto libres, y el repositorio lo exige (`duplicate`).
- **Datos de ejemplo** (comida 300 €, ocio 100 €, transporte 80 €) para cada hogar nuevo en modo memoria, para ver las barras sin configurar nada.
- **Hub con entradas "Próximamente"** en vez de rutas vacías: se ven pero no se pueden pulsar (`disabled` + pista de accesibilidad), y B-4.2 / B-4.3 solo cambian su `href`.
- **Rutas protegidas**: la carpeta `budgets` se registra dentro de la fase `ready`; sin sesión el deep link `/budgets` no abre.
- **Accesibilidad**: cada barra es un `progressbar` con su porcentaje, el total del mes y los estados se leen como texto ("Te has pasado 20,00 €"), y el aviso no depende solo del color.

## Cómo probarlo
1. `npx expo start --port 8082` (modo memoria): **Planificar → Presupuestos** (ya hay tres de ejemplo).
2. Añade un gasto de comida con `+` y vuelve: la barra avanza. Pásate del límite y comprueba el rojo y el texto.
3. **Mover desde Comida** hacia Ocio, prueba un importe demasiado grande y mira el mensaje.
4. **Nuevo presupuesto**, **Editar** y **Eliminar** (con su confirmación). Vuelve a **Inicio** y mira el bloque.

## Tests
- Dominio: `budgetProgress` (umbrales, redondeos, límites a cero, orden), casos de uso.
- Repositorio en memoria: `spent` derivado (categoría, mes, hogar, tipo), duplicados, datos de ejemplo, editar, borrar y las reglas de `moveAmount`.
- ViewModels: lista, formulario (crear/editar/borrar con confirmación) y mover, con sus validaciones y errores.
- Pantallas: `BudgetBar`, `BudgetsScreen`, `PlanHubScreen` y el bloque de presupuestos de Inicio. En `navigation.test.tsx`: Planificar → Presupuestos → volver y el deep link sin sesión.
- Sin probar en dispositivo: el aspecto de las barras ámbar/roja.
- **Pendiente:** `ApiBudgetRepository` en el contenedor (4.9); copiar los presupuestos del mes anterior (idea de backlog).

## Para la entrevista
"El gasto de un presupuesto nunca se guarda: se deriva de los movimientos, así que añadir o borrar un gasto mueve las barras sin sincronizar nada, y los ViewModels solo tienen que invalidar el prefijo de caché de presupuestos. Los umbrales viven en una función pura con céntimos enteros —80 % para ámbar, exceder es gastar un céntimo más que el límite— y los pruebo en los bordes. Mover importe entre presupuestos conserva el total y no deja al origen por debajo de lo ya gastado; la pantalla enseña el antes y el después. Y como sin backend no hay base de datos común, los adaptadores en memoria comparten un único almacén de movimientos."
