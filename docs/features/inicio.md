# Feature: Inicio

Tarea B-3.2 · Pantalla 04 del lienzo, maquetación **C · Gasto diario** ([ADR-0009](../adr/0009-direccion-visual-midnight-glass.md)) · Sustituye a la pantalla de referencia de [Resumen mensual](resumen-mensual.md)

## Qué hace
La primera pestaña responde a una sola pregunta: **¿cuánto puedo gastar hoy sin quedarme sin dinero antes de fin de mes?** Muestra:
- La cifra grande **"Disponible hoy"** (en rojo si ya te has pasado) y una línea con el reparto diario y los días que quedan.
- La **cabecera del hogar** con el nombre y los avatares de sus miembros.
- Las **barras de la semana** (lunes a domingo, hoy resaltado) y su total.
- Cuánto **queda en el mes** y los **últimos movimientos**.
- Tirar hacia abajo refresca. La sección de **presupuestos** tiene su hueco reservado (`state.budgets`) pero está oculta hasta la fase 4.

**Analogía:** es un "safe to spend" tipo Monzo / YNAB; en Android sería un `HomeViewModel` que combina tres `Flow`s (gasto diario, semana y recientes) en un `UiState`.

## La regla del gasto diario

```
dinero al empezar hoy = saldo del mes + lo gastado hoy
gasto diario          = dinero al empezar hoy ÷ días que quedan (hoy incluido), redondeado HACIA ABAJO al céntimo
disponible hoy        = gasto diario − gastado hoy        (puede ser negativo)
```
- **Hoy cuenta como día restante**: el 14 de octubre quedan 18 días (14…31); el último día del mes queda 1 y todo lo que sobra es para hoy.
- **Lo que gastas hoy no le roba a mañana el reparto**: el saldo ya lo incluye, así que se vuelve a sumar para calcular lo que había *al empezar* el día.
- **Redondeo hacia abajo**: nunca se promete un céntimo que no existe (hay un test que comprueba que gasto diario × días ≤ dinero).
- **Saldo cero o negativo → gasto diario 0** y estado `month-in-deficit` ("este mes ya has gastado más de lo que ha entrado"), nunca un reparto negativo.
- **Febrero** (28 o 29 días, años bisiestos y los siglos que no lo son) y los meses de 30/31 días salen del calendario, no de una tabla.
- Los movimientos con fecha posterior a hoy (un alquiler apuntado por adelantado) no cuentan todavía.

## Cómo está construida

```
mobile/src/features/transactions/
├── domain/
│   ├── calendar.ts            días del mes, días restantes, semana (lunes primero), addDays…
│   ├── dailyAllowance.ts      computeDailyAllowance(): la regla de arriba, pura
│   └── usecases/              GetDailyAllowance · GetWeeklySpending · GetRecentTransactions
└── presentation/home/
    ├── useHomeViewModel.ts    3 queries → un único HomeUiState (loading | error | success)
    └── HomeScreen.tsx         la vista
mobile/src/shared/ui/BarChart.tsx   barras verticales con Views (no hace falta SVG para rectángulos)
mobile/src/app/(tabs)/index.tsx     re-exporta HomeScreen
```

## Decisiones y por qué
- **Tres queries pequeñas en vez de una grande** (gasto diario, semana, recientes): cada una se refresca sola y comparten prefijo `transactions.all(hogar)`, así que al guardar un movimiento (B-3.1) se invalidan todas con una sola llamada. La de "recientes" cuelga de `lists`, por eso el movimiento nuevo aparece **al instante** (la actualización optimista antepone a cualquier lista paginada).
- **La semana se pide con `list` y filtro de fechas**, no con dos `findByMonth`: una semana puede cruzar mes o año (la del 28 de septiembre al 4 de octubre) y así sale completa. Se recorren todas las páginas por si hubiera más de 100 movimientos.
- **Las reglas viven en el dominio y se prueban con tabla**: bordes de último día, febrero normal y bisiesto, saldo cero y negativo, gasto de hoy que supera el reparto, semanas que cruzan años y horario de verano (`addDays` deja que `Date` acarree meses).
- **El ViewModel formatea** (`Money.format`, fecha y día de la semana en es-ES) y calcula los ratios de las barras contra el día más cargado; con la semana vacía los ratios son 0, no `NaN`. La vista no contiene ni una cuenta.
- **Accesibilidad:** la cifra principal se lee como una frase ("Te quedan 42,10 € para gastar hoy…"), cada barra dice su día y su importe ("martes: 42,00 €") y el spinner está etiquetado.
- **Error útil:** un fallo de cualquiera de las tres consultas muestra un mensaje en español sin detalles técnicos y un botón **Reintentar** que las vuelve a pedir.
- Nota de formato: `Intl` en es-ES **no agrupa los números de cuatro cifras** ("1750,00 €"), pero sí desde cinco ("12.500,00 €"). Las pruebas aceptan ambos.
- Se eliminó la pantalla de referencia (`TransactionsScreen` + su ViewModel); el caso de uso `GetMonthlySummary` se queda, probado, para los presupuestos.

## Cómo probarlo
1. `npx expo start --port 8082` (modo memoria): cada hogar nuevo trae movimientos de ejemplo.
2. Mira la cifra grande y compárala a mano: (ingresos − gastos del mes + gastado hoy) ÷ días que quedan.
3. Añade un gasto con `+`: la cifra, las barras y la lista cambian al instante.
4. Tira hacia abajo para refrescar; apaga el modo avión en una prueba con la API para ver el error.

## Tests
- Dominio: `calendar`, `dailyAllowance` (≈20 casos), los tres casos de uso contra el repositorio en memoria.
- ViewModel: carga, cifras, barras, recientes con signo y fecha, hogar sin movimientos, pasarse del día, refresco, error y reintento. La fecha se congela en el miércoles 14 de octubre de 2026 sin parar los temporizadores de TanStack.
- UI: `BarChart` y `HomeScreen` (spinner → contenido, frase accesible, avatares, estado vacío, sin presupuestos).
- Sin probar en dispositivo: el aspecto del gráfico y el gesto de tirar para refrescar.
- **Pendiente:** el bloque de presupuestos (B-4.1) y conectar `ApiTransactionRepository` (3.9); el gasto diario usa `findByMonth`, que en la API debería salir de `monthlySummary` para no descargar el mes entero.

## Para la entrevista
"La pantalla de inicio responde a una pregunta: cuánto puedo gastar hoy. La regla vive en una función pura: el dinero que había al empezar el día —saldo más lo gastado hoy— entre los días que quedan contando hoy, redondeado hacia abajo al céntimo para no prometer dinero que no existe; con saldo cero o negativo el reparto es cero y la app lo dice. Los bordes (último día, febrero bisiesto, semanas que cruzan año) los cubre una tabla de tests y las fechas salen del calendario, no de constantes. El ViewModel combina tres consultas pequeñas bajo un mismo prefijo de caché, de modo que al guardar un movimiento todas se refrescan a la vez y la lista de recientes se actualiza de forma optimista."
