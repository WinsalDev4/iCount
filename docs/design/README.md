# Diseño

Lienzo de propuestas (privado, en claude.ai): https://claude.ai/artifact/9M82UirvdDj6yE6JyxvD8U

## Qué contiene
- **Flujo y direcciones**: diagrama de navegación completo y las 10 direcciones visuales.
- **Páginas 01–10**: una por pantalla del MVP, con 10 propuestas cada una.

Cada propuesta = **dirección visual** (colores, tipografía, formas) × **maquetación** (A, B o C). Se pueden combinar: por ejemplo, "dirección 02 con la maquetación C de la pantalla 04".

| # | Dirección | Tipografía | Carácter |
|---|---|---|---|
| 01 | Neo-Brutal | Space Grotesk | Bordes gruesos, sombras duras, amarillo y rosa |
| 02 | Midnight Glass | Sora | Oscuro, cristal translúcido, violeta y turquesa |
| 03 | Swiss Editorial | Archivo | Retícula, cifras enormes, rojo y negro, sin radios |
| 04 | Acid Terminal | JetBrains Mono | Consola, monoespaciada, lima sobre negro |
| 05 | Clay Soft | Fredoka + Nunito | Volúmenes blandos, lavanda, muy amable |
| 06 | Bento Mono | Manrope | Bloques tipo bento, neutro con naranja |
| 07 | Y2K Chrome | Syne + Outfit | Metalizado, azul eléctrico y magenta |
| 08 | Organic Earth | DM Serif Display + Work Sans | Natural, verde bosque y terracota |
| 09 | Memphis Pop | Bricolage Grotesque | Colores primarios, trama de puntos, juguetón |
| 10 | Luxe Noir | Cormorant Garamond + Jost | Banca privada, negro y oro |

| Pantalla | A | B | C |
|---|---|---|---|
| 01 Bienvenida | Tarjetas apiladas | Cifra protagonista | Beneficios |
| 02 Registro | Formulario | Social primero | Sin contraseña |
| 03 Tipo de economía | Opciones desplegables | Todo en uno | Con quién |
| 04 Inicio | Saldo + donut | Bento | Gasto diario |
| 05 Añadir movimiento | Teclado propio | Categoría primero | Texto libre |
| 06 Historial | Lista por días | Calendario | Por categoría |
| 07 Presupuestos | Barras | Anillos | Sobres |
| 08 Deudas | Resumen | Detalle + simulador | Estrategia |
| 09 Hogar compartido | Balance | Reparto visual | Actividad |
| 10 Asistente IA | Conversación | Hallazgos | Plan e hitos |

## Decisión pendiente
Elegir **una dirección visual** para toda la app y **una maquetación por pantalla**. Con eso se definirán los design tokens en `mobile/src/shared/ui/theme.ts` y se registrará la decisión en un ADR.

## Datos de ejemplo usados
Hogar "Casa Ana & Leo", octubre de 2026: ingresos 3.850 €, gastos 2.315,25 €, disponible 1.534,75 €. Deudas: coche 8.640 € (6,9%), tarjeta 1.250 € (21%), préstamo personal 3.200 € (5,9%). Son coherentes entre pantallas para poder comparar.
