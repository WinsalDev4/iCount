# ADR-0013: Autenticación sin contraseña con enlace mágico, JWT y refresh rotatorio

- **Estado:** Aceptado
- **Fecha:** 2026-10-14

## Contexto
La fase 2 introduce cuentas de usuario: hacen falta para compartir un hogar y sincronizar datos entre dispositivos. La pantalla de acceso elegida (02-C, [ADR-0009](0009-direccion-visual-midnight-glass.md)) es **sin contraseña**. Requisitos:
- **Datos financieros**: una sesión robada es grave, así que los tokens deben durar poco y poder revocarse.
- **App móvil**: la sesión tiene que sobrevivir a reinicios (no pedir el email cada día) y desbloquearse rápido.
- **Equipo de una persona**: nada de gestionar contraseñas (hash, políticas, recuperación) ni un proveedor de identidad de pago.
- Portfolio: el diseño debe poder defenderse frente a las amenazas típicas (robo de token, reutilización, enumeración de usuarios, fuerza bruta).

## Opciones consideradas
1. **Email + contraseña**: conocido, pero obliga a hashear, gestionar políticas, recuperar contraseñas y defenderse del *credential stuffing*. Peor UX en móvil.
2. **Proveedor gestionado** (Auth0, Clerk, Supabase Auth, Firebase): rápido y seguro, pero añade dependencia externa y coste, y la parte de seguridad no se demuestra en el portfolio.
3. **Login social** (Sign in with Apple/Google): excelente UX, pero exige cuentas de desarrollador y configuración nativa. Se deja para más adelante y es compatible con esta decisión.
4. **Passkeys (WebAuthn)**: lo más seguro y el futuro, pero en React Native/Expo aún exige módulos nativos y un dominio verificado. Para más adelante.
5. **Enlace mágico por email + tokens propios** ← elegida.

Para la sesión: **sesión opaca en servidor** (cada petición consulta la BD) frente a **JWT corto + refresh token revocable**.

## Decisión

### Acceso
1. `POST /v1/auth/magic-link { email }` responde **siempre 202**, exista o no el usuario (sin enumeración). Se envía un email con `icount://auth/verify?token=…`.
2. El token del enlace tiene **32 bytes aleatorios** (base64url) y se guarda solo su **hash SHA-256**. Es de **un solo uso** y caduca a los **15 min**. Pedir un enlace nuevo invalida los anteriores de ese email.
3. `POST /v1/auth/verify { token }` consume el token. Si el usuario no existe se crea: registrarse e iniciar sesión es el mismo flujo. Devuelve la sesión.
4. *Rate limiting* en `magic-link` por IP y por email (`@nestjs/throttler`), contra el *spam* de correos y la fuerza bruta.

### Sesión
- **Access token**: JWT firmado con **HS256** (solo lo verifica esta API, así que basta un secreto compartido) y válido **15 min**. Lleva `sub` (userId) y `exp`. No se guarda en el servidor y viaja en `Authorization: Bearer`.
- **Refresh token**: **opaco** (aleatorio, no JWT), válido **30 días**, guardado en BD **con hash** y agrupado en una **familia** por inicio de sesión.
- **Rotación**: cada `POST /v1/auth/refresh` marca el refresh usado y emite uno nuevo de la misma familia.
- **Detección de reutilización**: si llega un refresh **ya usado**, alguien tiene una copia (robo). Se **revoca toda la familia** y ambos dispositivos tienen que volver a entrar.
- `POST /v1/auth/logout { refreshToken }` revoca la familia (204).

### En la app
- El **refresh token** se guarda en **`expo-secure-store`** (Keychain en iOS, Keystore en Android). El access token solo vive **en memoria**.
- El `httpClient` añade el token y, ante un 401, hace un **refresh *single-flight*** (una sola llamada aunque fallen varias peticiones a la vez). Si el refresh falla, se cierra la sesión (A-2.3).
- **Biometría = desbloqueo local** (`expo-local-authentication`): pide Face ID o huella para usar la sesión guardada al abrir la app. **No** es un factor que el servidor conozca ni sustituye al refresh token: protege el móvil desbloqueado en manos ajenas.

## Por qué
- Sin contraseñas no hay nada que filtrar, reutilizar ni recuperar. El email ya es el mecanismo de recuperación de cualquier cuenta, así que el enlace mágico no empeora la seguridad real.
- **JWT corto + refresh revocable**: las peticiones normales no consultan la BD (escala bien) y aun así se puede cortar una sesión: el daño de un access token robado dura como mucho 15 min, y el refresh se revoca.
- **Rotación con detección de reutilización** (patrón del OAuth 2.0 Security BCP) convierte el robo de un refresh token en algo detectable.
- **Hash de los tokens en BD** (magic y refresh): una filtración de la base de datos no permite suplantar a nadie.
- La biometría local da la UX de "abrir con la cara" sin enviar datos biométricos a ningún sitio (nunca salen del chip seguro).

## Consecuencias
- Necesitamos **email transaccional**: en desarrollo, **Mailpit** en `docker compose` (SMTP 1025, web en http://localhost:8025); en producción, un proveedor SMTP (fase 6).
- Si el enlace se abre en otro dispositivo (el email en el PC), `icount://` no abre la app. Mitigación prevista: un **código de 6 dígitos** en el mismo email como alternativa, y *universal links* `https://` al tener dominio (fase 6).
- Secretos nuevos en el backend: `JWT_SECRET` (≥ 32 bytes) validado en la config. Rotarlo invalida todos los access tokens (como mucho 15 min de impacto).
- Contratos en `@icount/contracts` (`auth.ts`): `requestMagicLinkRequestSchema`, `verifyMagicLinkRequestSchema`, `refreshSessionRequestSchema`, `logoutRequestSchema`, `sessionDtoSchema`, `userDtoSchema`.
- Login social y passkeys se pueden añadir como **otras formas de obtener la misma sesión** (mismo par de tokens), sin cambiar el resto.

## Para la entrevista
"El login es sin contraseña: enlace mágico de un solo uso, 15 minutos, guardado con hash, y respuesta 202 siempre para no revelar qué emails existen. La sesión es un JWT de 15 minutos más un refresh token opaco y rotatorio con detección de reutilización: si alguien usa un refresh ya consumido, revoco toda la familia, porque significa que hay una copia. En el móvil, el refresh va en Keychain/Keystore vía SecureStore, el access token solo en memoria, y la biometría solo desbloquea localmente la sesión guardada."

Analogía Android/iOS: es el flujo de `AccountManager`/Keychain con un `Authenticator` de OkHttp (o un `RequestInterceptor` de URLSession) que renueva el token en un 401. La biometría es `BiometricPrompt` / `LAContext` protegiendo un secreto local.

Preguntas probables:
- *¿Por qué no guardar el JWT en AsyncStorage?* AsyncStorage es texto plano en disco; SecureStore cifra con hardware. Y el access token ni siquiera se persiste.
- *¿Cómo revocas un JWT?* No se revoca: dura 15 minutos. Lo revocable es el refresh token, que sí está en BD.
- *¿Qué pasa si dos peticiones refrescan a la vez?* La segunda presentaría un refresh ya usado y dispararía la detección de robo. Por eso el cliente hace refresh *single-flight*. Si hiciera falta, el servidor podría tolerar unos segundos de gracia.
- *¿Por qué HS256 y no RS256?* RS256 sirve cuando terceros verifican tus tokens con tu clave pública. Aquí solo los verifica la propia API, y HS256 es más simple y rápido. Si aparecen más servicios, se cambia a RS256 con JWKS.
- *¿La biometría es 2FA?* No. Es un cerrojo local del dispositivo, no un segundo factor que verifique el servidor.
