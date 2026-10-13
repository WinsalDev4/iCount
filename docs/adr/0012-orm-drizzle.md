# ADR-0012: Drizzle ORM para PostgreSQL en el backend

- **Estado:** Aceptado
- **Fecha:** 2026-10-13

## Contexto
[ADR-0004](0004-backend-nestjs-postgresql.md) eligió NestJS + PostgreSQL y dejó abierto el ORM. Lo que pide el dominio y el proyecto:
- **Consultas contables:** sumas por miembro, repartos, saldos y liquidaciones entre personas del hogar. Mucho `SUM … GROUP BY` y alguna consulta con `JOIN` y subconsultas.
- **Dinero en unidades menores enteras** ([ADR-0007](0007-dinero-en-unidades-menores.md)): columnas `bigint` que se mapean a `Money`.
- **Clean Architecture** ([ADR-0004](0004-backend-nestjs-postgresql.md)): el ORM vive en `infrastructure/` y el dominio no debe conocerlo.
- Proyecto **ESM** sobre Node 24 (Nest 12) y CI simple.
- Portfolio: tiene que poder defenderse en una entrevista.

## Opciones consideradas
1. **Prisma 7** — esquema en `schema.prisma`, cliente generado.
   - ✅ Muy popular y conocido en ofertas de empleo; migraciones y Prisma Studio muy pulidos; buena documentación con Nest.
   - ❌ **Paso de generación** (`prisma generate`) en local, en CI y tras cada cambio de esquema; lenguaje de esquema propio; las agregaciones complejas acaban en `$queryRaw` (SQL en texto, sin tipos).
2. **Drizzle ORM** — esquema en TypeScript, tipos inferidos, API con forma de SQL.
   - ✅ **Sin generación de código**: los tipos salen del propio esquema TS. Encaja con la filosofía "sin build" del monorepo ([ADR-0011](0011-npm-workspaces-y-paquetes-compartidos.md)).
   - ✅ **SQL-first**: `select().from().innerJoin().groupBy()` se lee como SQL y está tipado. Las consultas de saldos no necesitan escaparse a SQL crudo.
   - ✅ Ligero, sin motor binario, ESM nativo; `drizzle-kit` genera migraciones SQL revisables.
   - ❌ API todavía 0.x (con la 1.0 en beta): puede haber cambios incompatibles. No hay módulo oficial `@nestjs/drizzle` (se registra como un *provider*, unas pocas líneas).
3. **TypeORM** — el ORM "clásico" de Nest, con entidades decoradas.
   - ✅ Integración oficial con Nest; patrón familiar (como JPA/Hibernate).
   - ❌ Tipado débil en consultas, mantenimiento irregular, y las entidades con decoradores tientan a usarlas como modelo de dominio (rompe la separación de capas).
4. **Kysely** (*query builder*, sin ORM) — tipado excelente, SQL puro.
   - ❌ Hay que mantener a mano los tipos de las tablas o generarlos desde la BD, y las migraciones son más artesanales.

## Decisión
**Drizzle ORM** con el driver **node-postgres (`pg`)** y **drizzle-kit** para migraciones. Instalados en `backend/`, con `backend/drizzle.config.ts` apuntando a los esquemas de cada módulo (`src/modules/*/infrastructure/persistence/*.schema.ts`) y migraciones en `backend/drizzle/`.

## Por qué
- El núcleo del producto son **consultas de agregación sobre dinero**; un ORM con forma de SQL y tipado de extremo a extremo es la herramienta natural, y además enseña SQL en vez de esconderlo.
- **Sin codegen**: menos pasos en CI y en el día a día, y el mismo modelo mental que los contratos (TS fuente como única verdad).
- **Encaja con Clean Architecture**: las tablas de Drizzle son objetos planos en `infrastructure/`; los repositorios convierten filas ↔ entidades de dominio (`Money`, IDs). Nada de decoradores de persistencia en el dominio.
- Migraciones como **ficheros SQL versionados** que se revisan en el PR y se aplican en el despliegue (fase 6).

## Consecuencias
- Versiones fijadas con `^0.x` y el ORM aislado detrás de los repositorios: si cambia la API (o se migra a Prisma), solo cambia `infrastructure/`.
- Importes en `bigint`: se leen con `mode: 'number'` y se validan como enteros seguros al construir `Money` (o `mode: 'bigint'` si algún día hiciera falta superar 2^53 céntimos).
- A-1.1 crea el *provider* de base de datos, la primera migración y el *health check* contra Postgres.
- Scripts: `npm run db:generate -w @icount/backend` (genera migración), `db:migrate` (aplica) y `db:studio` (explorador web).

## Para la entrevista
"Elegí Drizzle frente a Prisma porque la parte difícil de iCount son consultas de agregación sobre dinero: saldos por miembro, repartos, liquidaciones. Drizzle me da SQL tipado sin escaparme a `queryRaw`, y no necesita generación de código, así que el CI es más simple. Lo aíslo detrás de repositorios: el dominio trabaja con `Money` y entidades puras, y las tablas de Drizzle solo existen en infraestructura. El riesgo es que sigue en 0.x; está acotado precisamente por esa frontera."

Analogía:
- **Drizzle ≈ Exposed (DSL)** en Kotlin o **GRDB** en Swift: tablas declaradas en código y consultas con forma de SQL.
- **Prisma ≈ Room/SQLDelight o Core Data con codegen**: defines el modelo y una herramienta genera el cliente.

Preguntas probables:
- *¿Por qué no TypeORM si es el de Nest?* Tipado de consultas débil y entidades con decoradores que se acaban filtrando al dominio.
- *¿Cómo evitas errores con decimales?* No hay decimales: `bigint` de céntimos en BD, `Money` en dominio y `amountMinor` entero en los contratos.
- *¿Cómo despliegas migraciones?* `drizzle-kit generate` crea SQL en el PR; el despliegue ejecuta `migrate` antes de arrancar la nueva versión (fase 6).
