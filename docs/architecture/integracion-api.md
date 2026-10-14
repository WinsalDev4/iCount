# Integración con la API real (cierres 2.9 y 3.9)

Hasta las fases 2 y 3, la pista B trabajó contra repositorios en memoria y la pista A construyó la API y los repositorios `Api*`. Las tareas de cierre conectan ambas partes y prueban la app **en el emulador contra el backend real**.

## Cómo se elige la fuente de datos

```
EXPO_PUBLIC_DATA_SOURCE=api  EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
                    │
        createContainer()  ── crea UNA vez createApiClients(): sesión + http público + http autenticado
                    │
        FeatureContext { dataSource, api }  ──▶ cada *.module.ts elige InMemory* o Api*
```

- `core/di/FeatureContext.ts`: lo que el contenedor entrega a cada módulo. `api` solo existe en modo `api`. Hay **una sesión y un par de clientes HTTP para toda la app**, como un `@Singleton OkHttpClient` compartido en Hilt.
- **Conectados:** auth (`ApiAuthRepository` con el cliente público y la sesión), household, categories y transactions (cliente autenticado).
- **Pendientes:** el resto de features (presupuestos, deudas, recurrentes, liquidaciones, actividad, push, asesor) se conectan en sus propios cierres (4.9, 5.9 y 7.9). Hasta entonces siguen como *stubs* que solo fallan si se llaman.
- `useSessionExpiry` (en el layout raíz): si el servidor rechaza la sesión (revocada o *refresh* reutilizado), la app la olvida y vuelve al login.

## Probarlo en local (Windows, sin Docker)
1. **Postgres**: el portátil de `E:\Documentos\GIT\.cache\pg` (puerto 54329). Después, `npx drizzle-kit migrate` en `backend/` con `DATABASE_URL` apuntando a él.
2. **Correo**: sin Docker no hay Mailpit. `node .cache/smtp-sink.mjs` es un receptor SMTP mínimo en el puerto 1025 que imprime el enlace mágico de cada correo.
3. **API**: `npx nest build && node dist/main.js` con un `backend/.env` local (ignorado por git).
4. **App**: `npx expo run:android` (*development build*: hay módulos nativos nuevos desde la fase 1) y Metro con `EXPO_PUBLIC_DATA_SOURCE=api EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`. En el emulador, `10.0.2.2` es el PC.
5. **Abrir el enlace mágico** desde el PC: `adb shell am start -a android.intent.action.VIEW -d "icount://auth/verify?token=…" dev.winsal.icount`.

## Qué se probó en el emulador (Pixel 8a, Android)
- **Fase 2:** onboarding → email → enlace mágico → elegir hogar compartido → crear "Piso Lavapies" → código de invitación → regla de reparto → Inicio. Después Ana cierra sesión, entra Leo y **se une con el código** (escrito en minúsculas): ve el hogar con los dos miembros y sus movimientos.
- **Fase 3:**
  - alta de un gasto con el teclado propio (POST 201), y se actualizan Inicio, la semana en barras y el historial con su calendario;
  - **arranque en frío sin backend**: la app abre al instante con los datos persistidos;
  - alta **sin backend**: el formulario avisa "No hay conexión" y conserva lo escrito, la fila optimista se revierte y la pantalla sigue mostrando los datos.

## Fallos que solo aparecieron contra la API real (corregidos)

| Síntoma | Causa | Arreglo |
|---|---|---|
| Todo alta de movimiento → 400 | El caso de uso generaba ids `tx-…`, y la API exige UUID para el id de cliente (idempotencia) | `uuidV4()` en `core/domain/uuid.ts` (usa `crypto` si existe) |
| Tras reiniciar, `amount.format is not a function` | La caché persistida se guardaba como JSON plano: `Money` volvía sin métodos, `Date` como texto y `Map` como `{}` | `cacheSerialization.ts`: etiqueta y revive `Money`, `Date` y `Map` al restaurar |
| Sin red, la app no arrancaba | La lista de hogares no se persistía, y la puerta de acceso esperaba su respuesta | Se persiste con el resto de la caché (que ya contiene datos más sensibles y se borra al cerrar sesión) |
| Sin red, Inicio pasaba a "No hemos podido cargar…" aunque tenía datos | Las pantallas trataban como error cualquier refresco fallido | Error solo si no hay nada que mostrar (Inicio, Historial y detalle) |
| Tras un refresco fallido, el siguiente arranque offline ya no tenía datos | Solo se persistían las consultas en estado `success` | Se persiste toda consulta con datos |
| Sin red, el error decía "Algo ha salido mal" | La renovación de token fallida se convertía en un 401 ficticio | `lastRenewalFailure()`: se propaga el error real (`network`) |
| Al cerrar sesión, Inicio seguía mostrando los datos del usuario anterior | `queryClient.clear()` no avisa a los observadores montados, y la puerta de acceso nunca veía la sesión nula | Primero `setQueryData(session, null)`, que sí avisa; después se borra el resto |

Cada arreglo tiene su test de regresión. El de `endSession` falla con el orden anterior.

## Pendiente para la pista B (no es de integración)
- Con el mes vacío (0 € de ingresos y gastos), Inicio dice en rojo "Este mes ya has gastado más de lo que ha entrado". Que el saldo cero cuente como déficit es una decisión documentada del dominio de B; solo el texto no encaja para un usuario recién llegado.

## Para la entrevista

**En 30 segundos:** "Las pantallas se construyeron contra repositorios en memoria detrás de puertos. Integrar fue cambiar una variable de entorno: el contenedor crea una única sesión y los clientes HTTP, y cada módulo elige su implementación. Probarlo en un emulador contra la API real destapó lo que los tests con dobles no podían ver: ids que la API rechazaba, una caché que perdía los tipos al serializarse, un cierre de sesión que no avisaba a las pantallas montadas y errores de red disfrazados de 401. Cada uno se arregló con su test de regresión."

Preguntas probables:
- *¿Por qué los tests no lo detectaron?* Los dobles en memoria aceptan cualquier id y nunca serializan. Por eso la tarea de cierre exige probar de punta a punta, y ahora hay tests de contrato para cada caso.
- *¿Cómo funciona offline?* TanStack Query persiste en MMKV las consultas con datos. Al arrancar se rehidratan antes del primer *render* y las pantallas muestran la última foto mientras la red falla. Las altas sin red avisan y se revierten.
- *¿No es un riesgo guardar datos financieros en el dispositivo?* Es la decisión de ADR-0014: mejora mucho la experiencia. Se borran al cerrar sesión, y la sesión está protegida por el almacén seguro y la biometría.
