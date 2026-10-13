# @icount/contracts

Esquemas **zod** (y sus tipos con `z.infer`) que comparten la API (`backend/`) y la app (`mobile/`).
Decisión y funcionamiento: [ADR-0011](../../docs/adr/0011-npm-workspaces-y-paquetes-compartidos.md).

- **Sin paso de build:** `exports` apunta a `src/index.ts`. Metro (app), Vitest y Node 24 (backend, con *type stripping*) leen TypeScript directamente.
- Por eso solo se admite **TypeScript borrable** (`erasableSyntaxOnly`: nada de `enum`, `namespace` ni *parameter properties*) y los imports relativos llevan la extensión `.ts`.
- Todo lo público se exporta desde `src/index.ts`.

```bash
npm run typecheck -w @icount/contracts
npm test -w @icount/contracts
```
