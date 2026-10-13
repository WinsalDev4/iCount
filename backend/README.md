# iCount — Backend

API REST de iCount: **NestJS 12 (ESM) + PostgreSQL 17 + Drizzle ORM**.
Decisiones: [ADR-0004](../docs/adr/0004-backend-nestjs-postgresql.md) (stack), [ADR-0011](../docs/adr/0011-npm-workspaces-y-paquetes-compartidos.md) (monorepo y contratos), [ADR-0012](../docs/adr/0012-orm-drizzle.md) (ORM).

Andamiaje creado en la tarea `1.0` con Nest CLI; la base (config, errores, health, OpenAPI, migraciones) llega en `A-1.1` del [plan](../docs/plan/fase-1-cimientos.md). Mientras tanto, la app usa repositorios en memoria (`EXPO_PUBLIC_DATA_SOURCE=memory`).

## Arrancar en local

Requisitos: Node 24 y Docker Desktop. Todo se ejecuta **desde la raíz del repo**.

```bash
npm install                        # instala todos los workspaces
cp backend/.env.example backend/.env
npm run db:up                      # PostgreSQL 17 en localhost:5432 (docker compose)
npm run start:dev -w backend       # API en http://localhost:3000 con recarga
```

## Scripts (`npm run <script> -w backend`)

| Script | Qué hace |
|---|---|
| `start:dev` | Nest en modo *watch* |
| `build` / `start:prod` | Compila a `dist/` y ejecuta |
| `lint` / `typecheck` / `format:check` | oxlint con tipos / `tsc --noEmit` / Prettier |
| `test` / `test:e2e` | Vitest (unitarios / e2e con supertest) |
| `db:generate` / `db:migrate` / `db:studio` | drizzle-kit: generar migración / aplicarla / explorador web |

## Estructura prevista (Clean Architecture, igual que la app)

```
backend/src/
├── modules/<bounded-context>/   # households, transactions, budgets, debts, ai-advisor
│   ├── domain/                  # entidades, value objects, puertos
│   ├── application/             # casos de uso
│   ├── infrastructure/          # repositorios (Drizzle: persistence/*.schema.ts), clientes externos
│   └── interface/               # controllers REST, DTOs (esquemas de @icount/contracts)
└── shared/
```

Los contratos con la app se importan de `@icount/contracts` (TypeScript sin build: Node 24 lo ejecuta con *type stripping*).
