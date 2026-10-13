# @icount/finance

Motor financiero de iCount: funciones **puras** sobre **céntimos enteros**, sin dependencias. Lo usan la app (simulaciones sin conexión) y la API (fuente de verdad), así que los números coinciden siempre. Decisión y reglas de redondeo: [ADR-0015](../../docs/adr/0015-motor-financiero-compartido.md).

Igual que `@icount/contracts`: sin paso de build, TypeScript borrable e imports relativos con `.ts` ([ADR-0011](../../docs/adr/0011-npm-workspaces-y-paquetes-compartidos.md)).

```bash
npm test -w @icount/finance
```
