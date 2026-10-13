# iCount — Backend

Pendiente de arrancar. Stack propuesto en [ADR-0004](../docs/adr/0004-backend-nestjs-postgresql.md): **NestJS (TypeScript) + PostgreSQL**.

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
