# ADR-0009: Dirección visual "Midnight Glass" y maquetación por pantalla

- **Estado:** Aceptado
- **Fecha:** 2026-10-13

## Contexto
Se exploraron 10 direcciones visuales × 10 pantallas del MVP en el lienzo de diseño ([docs/design/README.md](../design/README.md)). La app debe ser muy visual, transgresora y fácil de usar.

## Decisión
- **Dirección única: 02 · Midnight Glass** para toda la app.
- **Maquetación por pantalla: la que aparece en la propuesta 02 de cada página del lienzo.**

| Pantalla | Maquetación elegida |
|---|---|
| 01 Bienvenida | B · Cifra protagonista |
| 02 Registro | C · Sin contraseña (enlace mágico + biometría) |
| 03 Tipo de economía | A · Opciones desplegables |
| 04 Inicio | C · Gasto diario disponible |
| 05 Añadir movimiento | A · Teclado numérico propio |
| 06 Historial | B · Calendario de intensidad |
| 07 Presupuestos | A · Barras |
| 08 Deudas | B · Detalle + simulador |
| 09 Hogar compartido | C · Actividad con aprobaciones |
| 10 Asistente IA | B · Hallazgos |

Las otras maquetaciones del lienzo siguen disponibles como referencia si una pantalla necesita revisarse.

## Tokens
Fuente de verdad en código: `mobile/src/shared/ui/theme.ts`.

| Token | Valor |
|---|---|
| Fondo | `#0B0C1A` + dos resplandores radiales (violeta arriba-izquierda, turquesa derecha) |
| Superficie de cristal | `rgba(255,255,255,0.07)`, borde `rgba(255,255,255,0.12)`, desenfoque 18 |
| Texto / secundario | `#F2F1FF` / `#A9A8C8` |
| Acento / sobre acento | `#8C7BFF` / `#0B0C1A` |
| Acento secundario | `#3EE6D0` |
| Ingreso / gasto | `#4BE3A3` / `#FF7A93` |
| Categorías | `#8C7BFF` `#3EE6D0` `#FF7AC6` `#FFC46B` `#5B6CFF` |
| Tipografía | **Sora** 400 / 600 / 700 (Google Fonts, vía `@expo-google-fonts/sora`) |
| Radios | 14 (pequeño) · 18 (botón) · 22 (tarjeta) · círculo (FAB) |

## Implementación prevista
- Cristal: `expo-blur` (`BlurView`) sobre superficies; en Android, si el rendimiento cae, *fallback* a superficie semitransparente sin desenfoque.
- Resplandores del fondo y gráficos (donut, anillos): `react-native-svg`.
- Animaciones: `react-native-reanimated`.
- Solo tema oscuro de momento (`userInterfaceStyle: "dark"` en `app.json`).

## Por qué
- Lo oscuro con cristal transmite "producto financiero premium" sin la frialdad de un banco tradicional.
- El acento violeta con texto oscuro y el texto claro sobre fondo casi negro superan el contraste 4.5:1.
- Las maquetaciones elegidas priorizan la acción diaria (gasto disponible por día, teclado propio para añadir en 3 toques).

## Consecuencias
- El desenfoque tiene coste en Android de gama baja: medirlo en la fase de rendimiento.
- Un tema claro futuro solo requiere un segundo objeto de tokens con las mismas claves.

## Para la entrevista
"Definí los tokens de diseño como un objeto tipado `as const`: las pantallas nunca usan colores literales, así cambiar de tema o añadir modo claro es cambiar un objeto. El efecto cristal usa BlurView con degradación elegante en Android, porque el desenfoque en tiempo real es caro en GPUs modestas."
