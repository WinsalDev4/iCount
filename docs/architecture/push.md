# Notificaciones push de punta a punta

Decisión: [ADR-0017](../adr/0017-notificaciones-push.md) (Expo Push Service). Código:
- **App**: `mobile/src/core/notifications/` (permiso, token, toques) y `mobile/src/features/push/data/api/ApiPushRepository.ts`.
- **Backend**: `backend/src/modules/push/` (tokens, envío, *receipts*), con disparadores en transacciones, recurrentes y liquidaciones.
- **Contratos**: `@icount/contracts/push.ts` (`registerPushTokenRequestSchema`, `pushDataSchema`).

```
App                                   API                                   Expo Push Service → FCM / APNs
 │ enable() en contexto                │                                      │
 │  canal Android → permiso → token    │                                      │
 │ PUT /v1/me/push-tokens ───────────▶ │ push_tokens (upsert por token)       │
 │                                     │                                      │
 │            (Ana añade un gasto compartido)                                  │
 │                                     │ commit ─▶ afterCommit ─▶ entrega     │
 │                                     │   tokens de los aprobadores          │
 │                                     │   lotes de 100 ─────────────────────▶│ tickets
 │                                     │   push_tickets                       │
 │                                     │ cada 30 min: receipts ◀──────────────│
 │                                     │   DeviceNotRegistered → borra token  │
 │ toque ─▶ data.url validada ─▶ router.push('/household?filter=to-review')    │
```

## App (`core/notifications`)

| Pieza | Qué hace | Analogía nativa |
|---|---|---|
| `NotificationsGateway` | Puerto sobre el SO: ¿dispositivo real?, canal, permiso, token, `projectId` de EAS | Envoltorio de `NotificationManagerCompat` + `FirebaseMessaging` / `UNUserNotificationCenter` |
| `expoNotificationsGateway` | Adaptador con `expo-notifications`, `expo-device` y `expo-constants` (SDK 57) | — |
| `PushRegistration` | `enable()` pide permiso **en contexto**; `syncAfterSignIn()` re-registra **sin preguntar**; `signOut()` da de baja | Un `PushManager` propio |
| `useNotificationTaps(navigate)` | Abre la ruta del toque, tanto si la notificación arrancó la app (`getLastNotificationResponseAsync`) como si ya estaba abierta (listener) | `PendingIntent` / `didReceive response` |
| `routeFromNotificationData` | Solo rutas internas de Expo Router. Rechaza `https://`, `//host`, `/\host`, `/javascript:` | Validar el *deep link* antes de navegar |
| `configureForegroundNotifications()` | Con la app abierta: banner y lista, con sonido y sin *badge* (`shouldShowBanner/List`; `shouldShowAlert` está obsoleto en SDK 57) | `setForegroundPresentationOptions` |

Detalles de la doc versionada (SDK 57) que el código respeta:
- En **Android 13+** el aviso de permiso no aparece hasta que existe un canal, así que `ensureDefaultChannel()` va antes de pedir permiso y antes del token. El canal se llama `default`, igual que en el *config plugin* (`app.json`) y en el backend (`channelId: 'default'`).
- `getExpoPushTokenAsync({ projectId })` hace una petición de red: puede fallar sin conexión. `PushRegistration` devuelve `{ kind: 'failed' }` en lugar de lanzar, y se reintenta en el siguiente inicio de sesión o arranque.
- En iOS, el permiso **provisional** también cuenta como concedido.
- Las *push* remotas no llegan a emuladores ni a Expo Go en Android: hace falta un *development build* en un dispositivo físico.

`PushStatus` es una unión discriminada (`enabled | denied | unsupported | not-asked | failed`), así que la UI puede decir exactamente por qué no hay avisos.

**Pendiente de la integración (5.9):** llamar a `configureForegroundNotifications()` y a `useNotificationTaps(router.push)` en el layout raíz, componer `PushRegistration` en el contenedor con `ApiPushRepository` y llamar a `syncAfterSignIn()`/`signOut()` desde el flujo de sesión. Además, `enable()` desde el interruptor "Avisarme de gastos compartidos" o al unirse a un hogar. Sin `projectId` de EAS (`eas init`, tarea 6.0, la hace el usuario) el registro responde `unsupported: no-project` y no molesta.

## Backend (`modules/push`)
- **Registro** `PUT /v1/me/push-tokens` (idempotente: *upsert* por token; si el dispositivo inicia sesión con otra cuenta, el token pasa a esa cuenta) y `DELETE` al cerrar sesión (solo borra si el token es tuyo).
- **`PushNotifications`**: un puerto global (como `ActivityLog`). Los casos de uso llaman a `notify()` dentro de su transacción, pero el envío se hace en **`afterCommit`**. Es un hook nuevo de `TransactionRunner` (como `TransactionSynchronization.afterCommit` en Spring): si la transacción hace *rollback*, no sale ninguna notificación. Después se entrega en segundo plano, *fire and forget*: nunca alarga ni rompe la petición, y los errores se registran.
- **`ExpoPushSender`** (adaptador de `expo-server-sdk` 7) envía en lotes (`chunkPushNotifications`) con los reintentos del SDK. Los resultados vuelven en el mismo orden que los mensajes. Si un lote falla entero (red, 5xx), cuenta como error pero **no** como dispositivo muerto. Lo que no es un token de Expo nunca se envía.
- **Limpieza de tokens**: si un ticket ya dice `DeviceNotRegistered`, se borra en el acto. Los demás tickets se guardan en `push_tickets`, y cada 30 minutos se leen los *receipts* de los que tienen más de 15 minutos: los `DeviceNotRegistered` borran el token. Los que aún no tienen *receipt* se reintentan en la siguiente pasada.
- `EXPO_ACCESS_TOKEN` es opcional: solo hace falta si se activa *enhanced push security* en Expo.

### Qué notifica (ADR-0017)

| Evento | Cuándo | A quién | Abre |
|---|---|---|---|
| `shared-expense` | Alta de un gasto compartido (también los que crea el trabajo de recurrentes) | Quienes deben aprobarlo (todos los afectados menos el autor) | `/household?filter=to-review` |
| `approval-pending` | Edición de un gasto compartido (nueva ronda de aprobación) | Los mismos | `/household?filter=to-review` |
| `settle-reminder` | Lunes a las 19:00 (Madrid), como mucho una vez por semana | Miembros que deben 10 € o más | `/settle` |

Matiz respecto al ADR: con la regla de aprobación de ADR-0016, todo gasto compartido nuevo necesita aprobación. Por eso `shared-expense` abre directamente "por revisar" y `approval-pending` se reserva para las ediciones. Así nadie recibe dos avisos por el mismo gasto.

**Privacidad en la pantalla de bloqueo**: solo el nombre y el importe del gasto (`«Compra» · 12,34 €`, formateado desde los céntimos sin coma flotante) y nunca saldos. El recordatorio de saldar no lleva cifras.

## Tests
- **Backend, unitarios**: `ExpoPushSender` con el **SDK simulado** (lotes, orden de resultados, tokens no válidos, fallo de un lote entero, *receipts*); entrega, limpieza por tickets y por *receipts* (espera de 15 min, reintento de los no respondidos) con dobles en memoria; `afterCommit` y `formatMoney`.
- **Backend, e2e** (`test/push.e2e-spec.ts`, con un `PushSender` en memoria en lugar de Expo): registro idempotente y cambio de cuenta, validación del token, aviso a los aprobadores y no al autor, nueva ronda al editar, nada para gastos privados, borrado de dispositivos muertos y recordatorio semanal solo a quien debe ≥ 10 €, sin cifras.
- **App**: `PushRegistration` (orden canal → permiso → token, nunca pregunta tras el login, denegado, emulador o sin proyecto, fallos sin excepción, baja una sola vez), el adaptador Expo (permisos, provisional, token, *handler*), las rutas seguras y `useNotificationTaps` (arranque en frío, toques en caliente, otras acciones ignoradas, baja del listener) y `ApiPushRepository`.

## Para la entrevista

**En 30 segundos:** "La app pide permiso en contexto, crea antes el canal de Android 13, obtiene el token de Expo y lo registra en mi API. El backend avisa a quien tiene que aprobar un gasto compartido, pero solo después del commit, con un hook `afterCommit` en mi unidad de trabajo, así que un *rollback* no deja notificaciones fantasma. Envía en lotes con el SDK oficial y limpia los tokens muertos a partir de tickets y *receipts*. Al tocar la notificación, la app valida que la ruta sea interna antes de navegar."

Preguntas probables:
- *¿Por qué `afterCommit` y no enviar en el caso de uso?* Una notificación no se puede deshacer. Si la enviara antes del commit y la transacción fallara, avisaría de un gasto que no existe. Es el mismo problema que publicar en Kafka dentro de una transacción. A mayor escala usaría el patrón *outbox*.
- *¿Y si el servidor se reinicia con envíos pendientes?* Hoy se pierden (cola en memoria, decisión consciente para un hogar). El siguiente paso sería una tabla *outbox* o una cola persistente: el puerto `PushNotifications` no cambia.
- *¿Por qué dos pasos para limpiar tokens?* El ticket solo dice que Expo aceptó el mensaje. El *receipt*, minutos después, dice si FCM/APNs lo entregó. `DeviceNotRegistered` puede llegar por cualquiera de los dos caminos.
- *¿Cómo evitas que una notificación abra una web maliciosa?* El `data.url` se valida con el contrato (empieza por `/`) y además se rechazan `//host`, `/\host` y esquemas. Es la misma higiene que validar un *deep link* en un `Activity` exportado.
