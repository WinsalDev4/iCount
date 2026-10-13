# iCount — Backend

Stack decidido en [ADR-0004](../docs/adr/0004-backend-nestjs-postgresql.md): **NestJS (TypeScript) + PostgreSQL**. Se crea en la tarea `1.0` y se construye en `A-1.1` del [plan](../docs/plan/fase-1-cimientos.md).

Mientras tanto, la app usa repositorios en memoria (`mobile/src/features/*/data/InMemory*Repository.ts`). Cambiar a la API real solo requiere tocar el composition root (`mobile/src/core/di/container.ts`).

Estructura prevista (Clean Architecture, igual que la app):

```
backend/src/
├── modules/<bounded-context>/   # households, transactions, budgets, debts, ai-advisor
│   ├── domain/                  # entidades, value objects, puertos
│   ├── application/             # casos de uso
│   ├── infrastructure/          # repositorios (ORM), clientes externos
│   └── interface/               # controllers REST, DTOs, validación
└── shared/
```
