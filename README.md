# iCount

> Finanzas personales y **economías compartidas** (parejas, familias, pisos) en una app móvil muy visual.

iCount registra ingresos y gastos, los clasifica (comida, facturas, vivienda, préstamos, letras del coche, seguros…), planifica pagos recurrentes y deudas, y en el futuro usará IA para proponer planes de ahorro y de amortización de deuda.

## Monorepo

| Carpeta | Contenido | Stack |
|---|---|---|
| [`mobile/`](mobile/) | App iOS / Android | React Native 0.86 · Expo SDK 57 · Expo Router · TypeScript 6 |
| [`backend/`](backend/) | API REST | Propuesta: NestJS + PostgreSQL ([ADR-0004](docs/adr/0004-backend-nestjs-postgresql.md)) |
| [`docs/`](docs/) | Decisiones técnicas (ADR), features, diseño y guías de aprendizaje | Markdown |

## Arquitectura

Clean Architecture + MVVM, organizada **por feature**:

```
mobile/src/
├── app/                     # Rutas (Expo Router). Solo mapean URL → pantalla
├── core/                    # Transversal: DI (composition root), dominio común (Money)
├── shared/                  # UI reutilizable, tema, utilidades
└── features/<feature>/
    ├── domain/              # Entidades, puertos (interfaces de repositorio), casos de uso. TS puro
    ├── data/                # Implementaciones de repositorios, DTOs, mappers, API
    └── presentation/        # ViewModel (custom hook) + View (componentes)
```

La regla de dependencias apunta hacia dentro: `presentation → domain ← data`. El dominio no importa React ni React Native. Detalle en [ADR-0003](docs/adr/0003-arquitectura-clean-mvvm.md).

## Empezar

Requisitos y configuración del equipo (Windows): [docs/setup/entorno-windows.md](docs/setup/entorno-windows.md).

```bash
cd mobile
npm install
npm start          # Metro + Expo Dev Tools
npm run android    # build de desarrollo en emulador/dispositivo
npm test           # Jest
npm run lint && npm run typecheck
```

## Flujo de trabajo

[Git Flow](docs/adr/0005-git-flow.md): `main` (producción) · `develop` (integración) · `feature/*` · `release/*` · `hotfix/*`. Commits con [Conventional Commits](https://www.conventionalcommits.org/).

## Documentación

- [Índice de decisiones (ADR)](docs/adr/)
- [Features](docs/features/)
- [Diseño y flujos](docs/design/)
- [De Android/iOS a React Native](docs/learning/android-ios-a-react-native.md)
