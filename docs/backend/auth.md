# Autenticación (backend)

Implementación de [ADR-0013](../adr/0013-autenticacion-sin-contrasena.md): acceso sin contraseña con enlace mágico, JWT de acceso de 15 minutos y *refresh token* rotatorio con detección de reutilización. Código en `backend/src/modules/auth` y `backend/src/shared/auth`.

## Endpoints

| Método y ruta | Público | Qué hace | Respuestas |
|---|---|---|---|
| `POST /v1/auth/magic-link` `{ email }` | Sí | Envía el enlace `icount://auth/verify?token=…` | **202 siempre** (exista o no la cuenta), 400, 429 |
| `POST /v1/auth/verify` `{ token }` | Sí | Consume el enlace y crea la sesión (alta en el primer uso) | 200 `SessionDto`, 401 `/problems/invalid-magic-link` |
| `POST /v1/auth/refresh` `{ refreshToken }` | Sí | Rota el *refresh token* | 200 `SessionDto`, 401 `/problems/invalid-refresh-token` o `/problems/refresh-token-reused` |
| `POST /v1/auth/logout` `{ refreshToken }` | Sí | Revoca la familia de la sesión | 204 (idempotente) |
| `GET /v1/me` | No | Usuario actual | 200 `UserDto`, 401 |

Los cuerpos se validan con los esquemas de `@icount/contracts` (`auth.ts`). Todos los errores salen como *problem details* (RFC 9457).

## Cómo funciona

```
App                                   API                                  BD
 │ POST /auth/magic-link {email} ───► │ límite por email (3 / 15 min)       │
 │                                    │ invalida enlaces pendientes ───────► magic_links
 │                                    │ token = 32 bytes aleatorios
 │                                    │ guarda SHA-256(token), 15 min ─────► magic_links
 │ ◄──── 202                          │ email con icount://auth/verify?token=…  (Mailpit)
 │ (el usuario toca el enlace → deep link → la app recibe el token)
 │ POST /auth/verify {token} ───────► │ UPDATE … SET used_at WHERE hash AND no usado AND no caducado RETURNING email
 │                                    │ usuario por email (o alta) ───────► users
 │                                    │ nueva familia de refresh ─────────► refresh_tokens (hash, 30 días)
 │ ◄──── {accessToken (JWT 15 min), refreshToken, user}
 │ … 15 min después, una petición da 401 …
 │ POST /auth/refresh {refreshToken} ► │ ¿usado ya? → revoca la familia, 401 refresh-token-reused
 │                                    │ UPDATE … SET used_at WHERE id AND used_at IS NULL (atómico)
 │ ◄──── nuevo par (misma familia)    │
```

### Piezas
- **`JwtAuthGuard` global** (`APP_GUARD`): cualquier ruta exige `Authorization: Bearer <jwt>` salvo las marcadas con `@Public()` (auth, `/health`). El usuario queda en `request.auth` y se lee con `@CurrentUser()`.
- **`AccessTokenService`** (compartido): firma y verifica JWT HS256 con `{ sub, typ: 'access' }`. Solo acepta `typ: 'access'`, para que ningún otro token firmado con el mismo secreto sirva como acceso.
- **Casos de uso** sin dependencias de Nest: `RequestMagicLink`, `VerifyMagicLink`, `RefreshSession`, `Logout`, `GetCurrentUser`. `SessionIssuer` emite el par de tokens.
- **Puertos**: `UserRepository`, `MagicLinkRepository`, `RefreshTokenRepository`, `SecureTokens`, `AccessTokenIssuer` y `EmailSender` (compartido, con un adaptador SMTP con nodemailer).
- **Tablas**: `users` (email único), `magic_links` (índice por email + fecha) y `refresh_tokens` (índice por familia, FK a `users` con borrado en cascada). Migración `drizzle/0001_auth.sql`.

## Amenazas cubiertas

| Amenaza | Defensa |
|---|---|
| Robo de la base de datos | Solo se guardan **hashes SHA-256** de los tokens de enlace y de *refresh*. Con tokens aleatorios de 256 bits, un hash rápido es seguro (no hay diccionario posible, al contrario que con contraseñas). |
| Reenvío del enlace (alguien lo ve después) | Un solo uso, 15 minutos, y pedir otro invalida los anteriores. |
| Dos verificaciones simultáneas del mismo enlace | Se consume con una única sentencia `UPDATE … WHERE used_at IS NULL … RETURNING`: solo una gana. |
| Robo de un *refresh token* | Rotación y **detección de reutilización**: si vuelve un token ya usado, se revoca toda la familia y el atacante y la víctima tienen que volver a entrar. La víctima lo nota; el atacante pierde el acceso. |
| Dos *refresh* simultáneos con el mismo token | `markUsed` atómico: uno gana y el otro se trata como reutilización. El cliente debe hacer *refresh* de uno en uno (*single-flight*, A-2.3). |
| Enumeración de cuentas | `magic-link` responde 202 con el mismo cuerpo, exista o no el email. |
| *Spam* de correos y fuerza bruta | Límite por email (3 cada 15 minutos) en el dominio y por IP con `@nestjs/throttler` (5/min en `magic-link`, 10/min en `verify`, 30/min en `refresh`). |
| JWT falsificado o de otro tipo | HS256 con secreto de 32 caracteres o más, algoritmo fijado al verificar (sin `alg: none`) y `typ: 'access'` obligatorio. |
| Access token robado | Dura 15 minutos y no se puede revocar (es el precio de no consultar la BD). Por eso es corto y la app lo guarda solo en memoria. |

Pendiente para producción (fase 6): almacén compartido para los límites por IP si hay varias instancias, rotación del `JWT_SECRET` y un proveedor SMTP real con SPF/DKIM.

## Probar en local

```bash
docker compose up -d                 # PostgreSQL + Mailpit
npm run db:migrate -w backend
npm run start:dev -w backend
curl -X POST localhost:3000/v1/auth/magic-link -H 'content-type: application/json' -d '{"email":"ana@icount.app"}'
# Abre http://localhost:8025, copia el token del enlace:
curl -X POST localhost:3000/v1/auth/verify -H 'content-type: application/json' -d '{"token":"…"}'
```

Tests: `npm test -w backend` (casos de uso con *fakes*: un solo uso, caducidad, límites, rotación, reutilización) y `npm run test:e2e -w backend` (flujo HTTP completo contra PostgreSQL, incluida la carrera de dos *refresh* simultáneos).

## Para la entrevista

**En 30 segundos:** "Login sin contraseña: enlace mágico de un solo uso que se consume con un `UPDATE … RETURNING` atómico. La sesión es un JWT de 15 minutos más un *refresh token* opaco y rotatorio. Si vuelve un *refresh* ya usado, asumo robo y revoco toda la familia. En la base de datos solo hay hashes. Un *guard* global hace que todo sea privado por defecto, y `@Public()` es la excepción explícita."

Analogía con Spring Security: `JwtAuthGuard` es un `OncePerRequestFilter` que rellena el `SecurityContext`, `@Public()` es un `permitAll()` y `@CurrentUser()` equivale a `@AuthenticationPrincipal`.

Preguntas probables:
- *¿Por qué SHA-256 y no bcrypt para los tokens?* bcrypt protege secretos de baja entropía (contraseñas) frente a ataques de diccionario. Un token de 256 bits aleatorios no se puede adivinar, así que un hash rápido basta y permite buscarlo por índice.
- *¿Qué pasa si el atacante usa el refresh robado antes que la víctima?* El atacante obtiene un par nuevo. Cuando la víctima intente refrescar con su token (ya usado), se detecta la reutilización y se revoca la familia, incluida la del atacante.
- *¿Cómo cierras sesión en todos los dispositivos?* Revocando todas las familias del usuario (`UPDATE refresh_tokens SET revoked_at … WHERE user_id = …`). Los access tokens vivos expiran en, como mucho, 15 minutos.
- *¿Por qué el límite por email está en el dominio y el de IP en un guard?* El de email es una regla de negocio (no saturar el buzón de nadie) y debe sobrevivir a varias instancias (está en BD). El de IP es protección de infraestructura.
