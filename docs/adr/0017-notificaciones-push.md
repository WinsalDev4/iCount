# ADR-0017: Notificaciones push con Expo Push Service

- **Estado:** Aceptado
- **Fecha:** 2026-10-14

## Contexto
En un hogar compartido hay que avisar de lo que hacen los demás: un gasto compartido nuevo, un gasto pendiente de mi aprobación, un recordatorio para saldar. La app es Expo (SDK 57), iOS y Android, desarrollada desde Windows.

## Opciones consideradas
1. **FCM (Android) + APNs (iOS) directamente** desde el backend: control total, pero dos integraciones, certificados y claves en el servidor, y tokens nativos distintos por plataforma.
2. **Proveedor de terceros** (OneSignal, Pusher Beams): segmentación y analíticas, pero otro SDK nativo, otra cuenta y datos de usuarios fuera.
3. **Expo Push Service** ← elegida: un único token por dispositivo (`ExponentPushToken[…]`) y un único endpoint HTTP. Expo reenvía a FCM y APNs con las credenciales configuradas en EAS.

## Decisión
- **App** (`expo-notifications` + `expo-device` + `expo-constants`):
  - Pide permiso **en contexto**: al activar "avisarme de gastos compartidos" o tras unirse a un hogar, no al abrir la app.
  - En Android crea antes el canal `default`, como exige Android 13 para que aparezca el aviso de permiso.
  - Obtiene el token con `getExpoPushTokenAsync({ projectId })`, usando el `projectId` de EAS (`Constants.expoConfig.extra.eas.projectId`).
  - Solo en **dispositivos reales** (`Device.isDevice`): los emuladores no reciben *push* remotas.
  - Registra el token tras iniciar sesión (`PUT /v1/me/push-tokens`) y lo da de baja al cerrar sesión.
  - Al **tocar** una notificación abre `data.url`, una ruta de Expo Router validada con `pushDataSchema`: debe empezar por `/`, así que una notificación nunca abre una URL externa.
- **Backend** (`expo-server-sdk`):
  - Tabla de tokens por usuario y dispositivo, con registro idempotente.
  - Envío en **lotes** (`chunkPushNotifications`) y, más tarde, lectura de los **receipts**: los tokens con `DeviceNotRegistered` se borran.
  - El envío nunca bloquea la petición que lo provoca: se encola en memoria y se procesa fuera del ciclo de la petición (cola persistente si hace falta escalar).
- **Eventos que notifican** (`pushEventSchema`):

  | Evento | A quién | Abre |
  |---|---|---|
  | `shared-expense` | Miembros afectados, menos el autor | `/household` |
  | `approval-pending` | Quien debe aprobar | `/household?filter=to-review` |
  | `settle-reminder` | Deudores con saldo > umbral, como mucho 1 por semana | `/settle` |

  Las notificaciones locales (recordatorio de pago recurrente, fase 4) no pasan por aquí.
- **Contenido**: títulos y cuerpos sin datos sensibles más allá del importe y el nombre del gasto, porque la pantalla de bloqueo es pública. Nada de saldos totales.

## Por qué
- Un token y un endpoint para las dos plataformas: es lo más sencillo para un equipo de una persona y es lo que Expo recomienda.
- Las credenciales de FCM/APNs se gestionan en EAS, no en nuestro servidor.
- El SDK oficial resuelve lotes, reintentos y receipts.

## Consecuencias
- **Requiere un proyecto EAS** (`eas init`, tarea 6.0, con la cuenta del usuario) para tener `projectId`. Además: credenciales FCM v1 subidas a EAS para Android y Apple Developer Program para iOS. Hasta entonces la integración se prueba con el SDK simulado (tests) y con la herramienta de envío de Expo en un dispositivo físico.
- Los emuladores no reciben *push* remotas. La prueba de la 5.9 necesita un móvil físico o se limita al registro y a la navegación al tocar.
- Dependencias: `expo-server-sdk` (backend) y `expo-device` (app). `expo-notifications` ya se instaló en la fase 4.
- Privacidad: el token es un dato personal del dispositivo. Se borra al cerrar sesión y cuando Expo informa de que no es válido.

## Para la entrevista
"Uso Expo Push Service: la app obtiene un token único de Expo y lo registra en mi API tras el login. El backend envía en lotes con el SDK oficial y limpia los tokens inválidos a partir de los receipts. Pido el permiso en contexto, no al abrir la app, porque la tasa de aceptación es mucho mayor. El payload solo trae una ruta interna que la app valida antes de navegar, así que una notificación no puede abrir nada externo."

Analogía Android/iOS: es FCM/APNs con una capa delante. El token de Expo encapsula el `FirebaseMessaging.getToken()` o el `deviceToken` de APNs, y tocar la notificación equivale a un `PendingIntent` / `UNNotificationResponse` con *deep link*.

Preguntas probables:
- *¿Por qué no FCM directo?* Habría que mantener dos integraciones y credenciales en el servidor. Si algún día se necesita (volumen, funciones avanzadas), el puerto `PushSender` del backend permite cambiar el adaptador.
- *¿Qué haces con tokens caducados?* Leo los receipts y borro los que devuelven `DeviceNotRegistered`.
- *¿Cómo evitas el spam?* Solo tres eventos, agrupados por hogar, y el recordatorio de saldar como mucho una vez por semana.
