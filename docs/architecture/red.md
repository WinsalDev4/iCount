# Capa de red de la app

Cómo habla la app con la API. Código en `mobile/src/core/`:

| Fichero | Qué es | Android | iOS |
|---|---|---|---|
| `config/env.ts` | `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_DATA_SOURCE`, validadas con zod al arrancar | `BuildConfig` | `Info.plist` / xcconfig |
| `network/httpClient.ts` | Cliente HTTP tipado sobre `fetch` | Retrofit + OkHttp | `URLSession` |
| `network/HttpError.ts` | Errores posibles como unión discriminada + `ApiError` para lanzar | `sealed class NetworkError` | `enum APIError: Error` |
| `domain/Result.ts` | `Result<T, E>` (`ok` / `err`) | `Result` / `Either` | `Result<Success, Failure>` |
| `query/queryClient.ts` | Factoría del `QueryClient` de TanStack Query: reintentos y caché | Repositorio con caché + `retryWhen` | — |

## El cliente HTTP

```ts
const http = createHttpClient({ baseUrl: env.apiUrl });

const result = await http.request('/v1/transactions', {
  query: { limit: 20 },
  schema: pageSchema(transactionDtoSchema),  // de @icount/contracts
  signal,                                     // cancelación (TanStack Query lo pasa)
});

if (result.ok) result.value;        // tipado: Page<TransactionDto>, ya validado
else result.error.kind;             // 'network' | 'timeout' | 'cancelled' | 'http' | 'validation'
```

Qué hace en cada petición:
1. **URL base** de `env.apiUrl` + ruta + *query string* (omite los `undefined`). La cadena se arma a mano porque el `URL` de React Native no implementa toda la API.
2. **Timeout** con `AbortController` (15 s por defecto, configurable por cliente y por petición), **enlazado** con la señal de cancelación del llamador. Así se distingue *timeout* de *cancelled*, cosa que `fetch` por sí solo no distingue. Se enlaza a mano porque `AbortSignal.any`/`AbortSignal.timeout` no están garantizados en Hermes.
3. **Cabeceras**: `Accept` JSON y problem+json, `Content-Type` si hay cuerpo, y un *hook* `headers()` asíncrono en la config para el token de sesión (fase 2).
4. **Respuesta 2xx → valida el cuerpo con el esquema zod** del contrato. Si el backend devuelve algo que no cumple el contrato (un campo que falta, un decimal donde va un entero), el error es `validation` aquí, en la frontera, y no un `undefined` tres pantallas después. Equivale a un *converter* de Retrofit que valida, o a un `JSONDecoder` estricto.
5. **Respuesta de error → `ProblemDetails`** (RFC 9457) parseado con el esquema tolerante de `@icount/contracts`. Si el cuerpo no es problem+json (la página HTML de un proxy), se construye uno con el estado.
6. **Nunca lanza**: todo resultado es un `Result`. Los fallos esperables (sin conexión, 404…) son datos, no excepciones.

En SDK 57 el `fetch` global de Android/iOS es el de `expo/fetch` (WinterCG, con `AbortSignal` estándar). El cliente lo recibe inyectado (`config.fetch`) para poder testearlo con un doble.

### Tipos de error y qué hace la UI

| `kind` | Cuándo | ¿Se reintenta? | UI típica |
|---|---|---|---|
| `network` | Sin conexión, DNS, TLS, servidor caído | Sí | "Sin conexión", botón reintentar |
| `timeout` | No responde a tiempo | Sí | Igual que red |
| `http` 5xx | Error del servidor | Sí | "Algo ha fallado, inténtalo de nuevo" |
| `http` 4xx | Petición rechazada: validación (400, con `errors[]` por campo), no existe (404), regla de negocio (422)… | No | Mensaje del `problem`, errores en el formulario |
| `validation` | 2xx que incumple el contrato | No (es un bug) | Error genérico + log |
| `cancelled` | La pantalla se desmontó o se canceló a propósito | No | Nada |

## TanStack Query: reintentos y caché

`createQueryClient()` (en 1.9 sustituye al `new QueryClient()` de `src/app/_layout.tsx`):
- **`retry`**: como mucho 2 reintentos (3 intentos en total), **solo** si el error es un `ApiError` de red, *timeout* o 5xx. Un 4xx volvería a fallar igual, y un error de programación no se arregla reintentando.
- **`retryDelay`**: *backoff* exponencial de 1 s, 2 s, 4 s…, con un máximo de 10 s.
- **`staleTime` 30 s**: dentro de ese margen, volver a una pantalla muestra la caché sin pedir otra vez.
- **Las mutaciones no se reintentan nunca**: si un `POST` hace *timeout*, puede que el servidor sí lo aplicara, y reintentarlo duplicaría el movimiento. Los reintentos seguros de escrituras llegarán con claves de idempotencia y la cola *offline* (A-3.2).

Para conectar un repositorio con TanStack Query, `unwrap` convierte el `Result` en excepción (TanStack necesita que `queryFn` rechace la promesa para marcar el error):

```ts
useQuery({
  queryKey: ['transactions', householdId],
  queryFn: ({ signal }) => repository.list(householdId, { signal }).then(unwrap),
});
```

El error que llega al ViewModel es un `ApiError`, y su `details` es el `HttpError` tipado.

## Configuración por entorno

| Variable | Por defecto | Notas |
|---|---|---|
| `EXPO_PUBLIC_DATA_SOURCE` | `memory` | `api` para usar el backend (cuando existan los repositorios de API) |
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000` | Emulador Android: `http://10.0.2.2:3000`. Móvil físico: IP del PC en la LAN. Solo `http`/`https` |

Se escriben en `mobile/.env.local` (ignorado por Git). Son **públicas**: van dentro del bundle, nunca deben contener secretos.

## Para la entrevista

**En 30 segundos:** "Tengo un cliente HTTP fino sobre `fetch` que nunca lanza: devuelve un `Result` con un error tipado (red, *timeout*, cancelado, HTTP con Problem Details o violación de contrato). Valida cada respuesta con el mismo esquema zod que usa el backend, así que los datos que entran en la app son correctos o fallan en la frontera. Encima, TanStack Query reintenta solo lo transitorio, con *backoff*, y nunca reintenta escrituras."

Preguntas probables:
- *¿Por qué no Axios?* `fetch` ya es estándar en Expo (WinterCG), y lo que aportaría Axios (interceptores, *timeout*) son unas decenas de líneas que aquí controlo y testeo. Una dependencia menos y nada de *polyfills*.
- *¿Por qué `Result` y no excepciones?* Para que el compilador obligue a tratar el fallo. Con `try/catch` se olvida fácilmente, y el tipo del `catch` es `unknown`. Con TanStack Query se convierte a excepción en un único punto (`unwrap`).
- *¿Cómo distingues un *timeout* de una cancelación?* Las dos abortan el mismo `AbortController`. El *timer* marca una bandera antes de abortar, y la señal del llamador indica si fue él.
- *¿Por qué no reintentas un POST?* No es idempotente: un *timeout* no significa que no se aplicara. Para reintentar escrituras hace falta una clave de idempotencia que el servidor deduplique.
- *¿Y sin conexión?* Esta capa solo informa del fallo. La persistencia de la caché y la cola de escrituras *offline* son de la fase 3 (A-3.2), junto con `onlineManager` y `NetInfo`.
