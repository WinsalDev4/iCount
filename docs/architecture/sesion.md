# Sesión en la app

Cómo guarda la app la sesión, añade el token a cada petición y lo renueva sin que el usuario lo note. Implementa el lado cliente de [ADR-0013](../adr/0013-autenticacion-sin-contrasena.md). Código en `mobile/src/core/auth` y `mobile/src/core/network`.

| Pieza | Qué hace | Android | iOS |
|---|---|---|---|
| `SessionStore` + `expoSecureStorage` | Guarda *refresh token* + usuario en Keychain/Keystore | `EncryptedSharedPreferences` | Keychain |
| `AuthSession` | *Access token* en memoria, renovación *single-flight*, cierre por caducidad | `AccountManager` + `Authenticator` | `URLSession` delegate |
| `withAuthentication(client, auth)` | Añade `Authorization` y reintenta una vez tras un 401 | OkHttp `Interceptor` + `Authenticator` | `RequestInterceptor` / `RequestRetrier` (Alamofire) |
| `biometrics` | Face ID / huella para desbloquear localmente | `BiometricPrompt` | `LAContext` |
| `createApiClients` | Monta el cliente público, el autenticado y la sesión | Módulo de Hilt de red | — |

## Qué se guarda y dónde
- **Refresh token + usuario (id, email, nombre)** en SecureStore, con la clave versionada `icount.session.v1` y accesibilidad `WHEN_UNLOCKED_THIS_DEVICE_ONLY`: solo se lee con el móvil desbloqueado y **no viaja en copias de seguridad** a otro dispositivo. El usuario se guarda para poder mostrar la app sin conexión.
- **Access token: solo en memoria.** Si la app muere, el primer request lo pide de nuevo con el *refresh*.
- Si lo guardado está corrupto, se trata como "sin sesión" y se borra (validado con zod).

## Una petición autenticada

```
ViewModel → repositorio → withAuthentication(http, session)
   1. token = session.accessToken()      ← si caduca en < 30 s, renueva antes
   2. request con Authorization: Bearer token
   3. ¿401? → session.refresh(token)     ← single-flight
              → nuevo token → reintenta UNA vez
              → null        → devuelve el 401 original
```

### Single-flight
Si tres pantallas piden datos a la vez y el token ha caducado, las tres reciben 401. Sin cuidado harían tres `POST /auth/refresh`, y como el servidor **rota y detecta reutilización**, el segundo *refresh* usaría un token ya consumido y **revocaría la sesión**. `AuthSession` guarda la promesa en curso (`inflight`): todas esperan al mismo *refresh*. Además, `refresh(rejectedToken)` comprueba si otra petición ya lo renovó mientras tanto. El test "3 peticiones concurrentes con 401 → 1 refresh" lo demuestra.

### Cuándo se cierra la sesión
- **El servidor rechaza el *refresh* (401)**: revocado, caducado o reutilizado. Se borra la sesión local y se avisa a `onSessionExpired`, que la navegación usará para volver al acceso.
- **Sin red, *timeout* o 5xx**: **no** se cierra. Se devuelve el error y el siguiente intento vuelve a probar. Echar al usuario por estar en el metro sería un bug.
- **`signOut()` voluntario**: `POST /auth/logout` (revoca la familia en el servidor, *best effort*) y borrado local, sin evento de caducidad.

## Repositorios de API
- `ApiAuthRepository` usa el **cliente público** (los endpoints de auth no llevan token) y `AuthSession`. Los tokens nunca salen de `core/auth`: el dominio solo ve `Session { user }`.
- `ApiHouseholdRepository` usa el **cliente autenticado** y traduce DTO ↔ dominio: `type` ↔ `kind`, `{ amountMinor, currency }` ↔ `Money`, IDs con marca de tipo.
- Los errores de la API (`/problems/<código>`) se convierten en errores de dominio (`AuthError`, `HouseholdError`) con `problemCode()`. La UI decide el mensaje por `reason`, nunca por el texto del servidor.

## Biometría
`expoBiometrics.isAvailable()` (hardware + huella o cara registrada) y `authenticate(motivo)`. Solo protege el acceso a la sesión ya guardada en este móvil. Si falla o se cancela, la sesión sigue guardada y se puede reintentar o entrar con un enlace nuevo. Pedirla al abrir la app (pantalla de bloqueo) es parte de la feature de acceso (pista B).

## Pendiente de conectar (2.9)
- Los módulos `auth` y `household` usarán `ApiAuthRepository` y `ApiHouseholdRepository` cuando `dataSource === 'api'`, con los clientes de `createApiClients({ baseUrl: env.apiUrl })`.
- La navegación se suscribirá a `session.onSessionExpired` para volver al acceso.

## Para la entrevista

**En 30 segundos:** "El *refresh token* vive en Keychain/Keystore, ligado al dispositivo, y el *access token* solo en memoria. Un decorador del cliente HTTP añade el token y, ante un 401, renueva una sola vez aunque haya varias peticiones a la vez: con rotación y detección de reutilización en el servidor, dos *refresh* simultáneos cerrarían la sesión. Solo cierro sesión si el servidor rechaza el *refresh*, nunca por falta de red."

Preguntas probables:
- *¿Por qué no un interceptor que refresca en cada 401 sin más?* Por la carrera: con tokens rotatorios, el segundo *refresh* parece un robo y revoca todo. Hace falta *single-flight*, igual que con `synchronized` en un `Authenticator` de OkHttp.
- *¿Por qué no guardar el access token?* Dura 15 minutos y renovarlo es barato. Guardarlo solo amplía la superficie de robo.
- *¿Qué pasa si se reinstala la app?* Keychain puede conservar datos entre instalaciones en iOS. Como la clave está versionada y el servidor rota y revoca, lo peor que ocurre es pedir un enlace nuevo.
