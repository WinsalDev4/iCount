# Architecture Decision Records

Cada decisión técnica relevante se documenta aquí con su contexto, alternativas y el porqué. Plantilla: [0000-plantilla.md](0000-plantilla.md).

| # | Decisión | Estado |
|---|---|---|
| [0001](0001-estructura-monorepo.md) | Monorepo `mobile/` + `backend/` + `docs/` | Sustituido por 0011 |
| [0002](0002-expo-como-framework.md) | Expo SDK 57 como framework de React Native | Aceptado |
| [0003](0003-arquitectura-clean-mvvm.md) | Clean Architecture + MVVM por feature (y por qué no MVP) | Aceptado |
| [0004](0004-backend-nestjs-postgresql.md) | Backend NestJS + PostgreSQL | Aceptado |
| [0005](0005-git-flow.md) | Git Flow + Conventional Commits | Aceptado |
| [0006](0006-gestion-de-estado.md) | TanStack Query + Zustand + Zod | Aceptado |
| [0007](0007-dinero-en-unidades-menores.md) | Dinero en unidades menores enteras (`Money`) | Aceptado |
| [0008](0008-testing-y-calidad.md) | Testing y calidad | Aceptado |
| [0009](0009-direccion-visual-midnight-glass.md) | Dirección visual Midnight Glass + maquetación por pantalla | Aceptado |
| [0010](0010-herramientas-y-builds.md) | VS Code + EAS Build (iOS desde Windows) | Aceptado |
| [0011](0011-npm-workspaces-y-paquetes-compartidos.md) | npm workspaces y paquetes compartidos sin paso de build | Aceptado |
| [0012](0012-orm-drizzle.md) | Drizzle ORM para PostgreSQL | Aceptado |
| [0013](0013-autenticacion-sin-contrasena.md) | Autenticación sin contraseña: enlace mágico, JWT + refresh rotatorio, biometría local | Aceptado |
| [0014](0014-cache-persistida-y-optimistas.md) | Caché persistida en MMKV y actualizaciones optimistas; offline completo aplazado | Aceptado |
| [0015](0015-motor-financiero-compartido.md) | Motor financiero compartido en `@icount/finance` (céntimos, TIN, redondeo) | Aceptado |
| [0016](0016-balances-y-liquidaciones.md) | Balances netos, mínimas transferencias (voraz) y aprobación de gastos compartidos | Aceptado |
| [0017](0017-notificaciones-push.md) | Notificaciones push con Expo Push Service | Aceptado |
| [0020](0020-asesor-ia.md) | Asesor con Claude solo en backend; números deterministas, privacidad y costes | Aceptado |
