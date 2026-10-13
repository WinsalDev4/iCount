# Arquitectura del backend

API de iCount: **NestJS 12 (ESM) + PostgreSQL 17 + Drizzle**, con Clean Architecture **por módulo**. Decisiones en [ADR-0004](../adr/0004-backend-nestjs-postgresql.md), [ADR-0011](../adr/0011-npm-workspaces-y-paquetes-compartidos.md) y [ADR-0012](../adr/0012-orm-drizzle.md).

> **Si vienes de Spring Boot:** Nest es casi lo mismo con otra sintaxis. `@Module` ≈ `@Configuration`, un *provider* ≈ un `@Bean`, `@Controller` ≈ `@RestController`, un *pipe* ≈ `@Valid` + un `Converter`, un *exception filter* ≈ `@ControllerAdvice`, `@Inject(TOKEN)` ≈ `@Qualifier`.

## Estructura

```
backend/
├── src/
│   ├── main.ts                 # carga .env → valida config → crea la app → listen
│   ├── bootstrap.ts            # configureApp(): logger, prefijo /v1, OpenAPI (lo usan main y los e2e)
│   ├── app.module.ts           # AppModule.forRoot(config): compone módulos
│   ├── shared/                 # transversal, sin lógica de negocio
│   │   ├── config/             # esquema zod del entorno + token APP_CONFIG
│   │   ├── database/           # pool de pg + cliente Drizzle (token DATABASE)
│   │   ├── domain/             # DomainError (clase base de errores de negocio)
│   │   ├── application/        # puertos comunes: Clock, IdGenerator
│   │   ├── logging/            # pino (JSON) con id de petición
│   │   └── interface/http/     # ProblemDetailsFilter, ZodValidationPipe, OpenAPI
│   └── modules/<contexto>/     # un bounded context por carpeta
│       ├── domain/             # entidades, value objects, errores, puertos (TS puro)
│       ├── application/        # casos de uso (clases sin decoradores)
│       ├── infrastructure/     # adaptadores: Drizzle (persistence/*.schema.ts), clientes externos
│       ├── interface/http/     # controller + DTOs (esquemas zod)
│       └── <contexto>.module.ts
├── drizzle/                    # migraciones SQL generadas (versionadas)
└── test/                       # e2e con supertest contra PostgreSQL real
```

**Regla de dependencias** (igual que en la app, [ADR-0003](../adr/0003-arquitectura-clean-mvvm.md)): `interface → application → domain ← infrastructure`. El dominio no importa Nest, Drizzle ni Express.

## Un request de principio a fin

```
POST /v1/notes {"text":"hola"}
  → pino-http asigna x-request-id                       (shared/logging)
  → NotesController.create                              (interface/http)
      → ZodValidationPipe(createNoteRequestSchema)      ✗ → RequestValidationError → 400
      → CreateNote.execute                              (application)
          → Note.create (invariantes)                   ✗ → InvalidNoteTextError (DomainError) → 422
          → NoteRepository.save  ── puerto ──► DrizzleNoteRepository → PostgreSQL
      → toNoteResponse (entidad → DTO)
  ← 201 {"id","text","createdAt"}
Cualquier excepción → ProblemDetailsFilter → application/problem+json (RFC 9457)
```

## Piezas transversales

| Pieza | Dónde | Qué hace | Equivalente Spring |
|---|---|---|---|
| Configuración | `shared/config/app-config.ts` | Valida `process.env` con zod **antes** de crear la app; si falla, el proceso no arranca y lista todos los errores | `@ConfigurationProperties` + `@Validated` |
| Logger | `shared/logging/logger.module.ts` | pino: JSON en una línea, `x-request-id` (lo propaga o lo genera) en cada log; legible con `pino-pretty` solo en desarrollo; oculta `authorization` y `cookie` | Logback + encoder JSON + MDC |
| Errores | `shared/interface/http/problem-details.filter.ts` | Todo error → RFC 9457. `RequestValidationError` → 400 con `errors[]` (`in`, `pointer`, `detail`); `DomainError` → 422/404/409/403 según `kind`; `HttpException` → su estado; resto → 500 genérico (la traza va al log, nunca al cliente) | `@ControllerAdvice` + `ProblemDetail` |
| Validación | `shared/interface/http/zod-validation.pipe.ts` | `@Body(new ZodValidationPipe(schema))`: valida y devuelve el valor ya tipado | `@Valid @RequestBody` |
| OpenAPI | `shared/interface/http/openapi.ts` | Swagger UI en `/docs`, JSON en `/docs/json`. Los esquemas salen de los **mismos** zod que validan (`zodToOpenApi`) | springdoc-openapi |
| Base de datos | `shared/database/database.module.ts` | Un `pg.Pool` por proceso y Drizzle encima; se cierra al apagar (`enableShutdownHooks`) | `DataSource` + `JdbcTemplate` |
| Health | `modules/health` | `GET /health` (sin versión): 200 si la BD responde (con latencia), 503 si no o si tarda más de 2 s. No expone el motivo, solo lo registra | Actuator `/health` |

Rutas: todo cuelga de `/v1` (la versión sale de `API_VERSION` en `@icount/contracts`), salvo `/health` y `/docs`.

## El módulo plantilla: `modules/notes`

Es la referencia para crear módulos nuevos (`households`, `transactions`…). Solo se monta fuera de producción (`AppModule.forRoot` lo excluye con `NODE_ENV=production`), para no exponer escrituras sin autenticación.

Receta para un módulo nuevo:
1. **Dominio** (`domain/`): entidad con constructor privado y `create()` que aplica las invariantes; `restore()` para reconstruir desde BD. Errores que extienden `DomainError` (`kind`, `code`, `title`). El puerto del repositorio como **clase abstracta**: sirve de tipo y de token de inyección sin depender de Nest.
2. **Casos de uso** (`application/`): una clase por operación, sin decoradores, con dependencias por constructor (puertos, `Clock`, `IdGenerator`). Tests con *fakes* en memoria; no hace falta Nest.
3. **Persistencia** (`infrastructure/persistence/`): `<x>.schema.ts` con `pgTable` y un repositorio Drizzle que convierte fila ↔ entidad. Después, `npm run db:generate -w backend -- --name <cambio>` y revisar el SQL generado en `drizzle/`.
4. **HTTP** (`interface/http/`): DTOs como esquemas zod (cuando existan, importados de `@icount/contracts`), controller fino (validar → caso de uso → mapear), `@ApiProblemResponses(...)` para documentar errores.
5. **Composición** (`<x>.module.ts`): `{ provide: Puerto, useClass: Adaptador }` y casos de uso con `useFactory` (como métodos `@Bean`). Registrar el módulo en `AppModule`.
6. **Tests**: unitarios junto al código (`*.spec.ts`) y e2e en `test/<x>.e2e-spec.ts` con `createTestApp()` y `truncate()`.

¿Por qué los casos de uso no llevan `@Injectable()`? Para que la capa de aplicación sea TypeScript puro, como el dominio: se pueden testear y reutilizar sin el contenedor de Nest. El coste son unas líneas de `useFactory` en el módulo.

## Tests

| Tipo | Comando | Qué cubre |
|---|---|---|
| Unitarios | `npm test -w backend` | Dominio, casos de uso, pipe, filtro y config. Sin BD ni red |
| e2e | `npm run test:e2e -w backend` | La app real (`AppModule` + `configureApp`) contra PostgreSQL: health (arriba y caído), notas, 400/404 en problem+json, OpenAPI, `x-request-id`, plantilla oculta en producción |

Los e2e usan **su propia base de datos** (`TEST_DATABASE_URL`, por defecto `icount_test` en el Postgres de `docker compose`). La crean si no existe, aplican las migraciones y vacían tablas entre tests. En CI (`.github/workflows/backend-ci.yml`) PostgreSQL 17 corre como *service container*.

```bash
npm run db:up                       # PostgreSQL 17 (Docker)
npm run test:e2e -w backend
```

## Para la entrevista

**En 30 segundos:** "El backend es NestJS con Clean Architecture por módulo. El dominio y los casos de uso son TypeScript puro; Nest solo aparece en los bordes: controllers, módulos de composición y adaptadores. La configuración se valida con zod antes de arrancar. Todos los errores salen en RFC 9457 desde un único filtro global, y los esquemas zod sirven a la vez de validación, de tipo TypeScript y de documentación OpenAPI. Los e2e levantan la app real contra un PostgreSQL de verdad, igual en local que en CI."

Preguntas probables:
- *¿Por qué RFC 9457 y no un formato propio?* Es un estándar (Spring 6 lo trae de serie). Los clientes pueden tratar todos los errores igual y se pueden ampliar con campos propios (`errors`, `traceId`).
- *¿Diferencia entre 400 y 422?* 400 = la petición no cumple el contrato (tipo, formato, campos de más), lo detecta el pipe antes de entrar al dominio. 422 = la petición es válida, pero viola una regla de negocio, y lo decide el dominio.
- *¿Por qué validar dos veces (DTO y entidad)?* El DTO protege la frontera HTTP. La entidad protege sus invariantes venga de donde venga (otro caso de uso, un *job*, un import). Son responsabilidades distintas.
- *¿Por qué clases abstractas como puertos y no interfaces?* Las interfaces de TypeScript desaparecen al compilar y no pueden ser tokens de inyección. Una clase abstracta es a la vez el contrato y el token: es lo más parecido a inyectar una interfaz en Spring.
- *¿Cómo depuras un error en producción?* Cada respuesta de error lleva `traceId`, que es el `x-request-id` de todas las líneas de log de esa petición. Si el cliente envía su propio `x-request-id`, se reutiliza para correlacionar app → API.
- *¿Por qué e2e contra Postgres real y no contra un mock?* Lo que se rompe en producción suele ser SQL, migraciones o tipos de columna, y un mock no lo detecta. Un *service container* en CI cuesta segundos.
- *¿Qué haría distinto con más escala?* Pool y *timeouts* por entorno, *readiness* y *liveness* separados, métricas (OpenTelemetry) y migraciones como paso de despliegue separado (fase 6).
