# iCount

> Finanzas personales y **economías compartidas** (parejas, familias, pisos) en una app móvil muy visual.

iCount registra ingresos y gastos, los clasifica (comida, facturas, vivienda, préstamos, letras del coche, seguros…), reparte los gastos comunes entre los miembros del hogar, planifica presupuestos, deudas y pagos recurrentes, y en una fase posterior usará IA para proponer planes de ahorro y de amortización de deuda.

## Stack

| Carpeta | Contenido | Stack |
|---|---|---|
| [`mobile/`](mobile/) | App iOS / Android | React Native 0.86 · Expo SDK 57 · Expo Router · TypeScript 6 · TanStack Query · Zustand · Zod |
| [`backend/`](backend/) | API REST | NestJS · PostgreSQL ([ADR-0004](docs/adr/0004-backend-nestjs-postgresql.md)) |
| [`docs/`](docs/) | Decisiones (ADR), plan por fases, features, diseño, aprendizaje | Markdown |

**Diseño:** dirección "Midnight Glass" (oscuro, superficies de cristal, tipografía Sora) — [ADR-0009](docs/adr/0009-direccion-visual-midnight-glass.md).

## Arquitectura

Clean Architecture + MVVM, organizada **por feature**:

```
mobile/src/
├── app/                     # Rutas (Expo Router). Solo mapean URL → pantalla
├── core/                    # Transversal: DI, red, sesión, configuración, dominio común (Money)
├── shared/ui/               # Design system Midnight Glass
└── features/<feature>/
    ├── domain/              # Entidades, puertos (interfaces), casos de uso. TS puro
    ├── data/                # Repositorios en memoria y de API, DTOs, mappers
    ├── presentation/        # ViewModel (custom hook) + View
    └── <feature>.module.ts  # Composición de la feature
```

Regla de dependencias: `presentation → domain ← data`. Detalle en [ADR-0003](docs/adr/0003-arquitectura-clean-mvvm.md).

## Empezar

Entorno (Windows, VS Code): [docs/setup/entorno-windows.md](docs/setup/entorno-windows.md).

```bash
cd mobile
npm install
npm start            # Metro
npm run android      # build de desarrollo en el emulador
npm test
npm run lint && npm run typecheck
```

## Hoja de ruta

Desarrollo por fases con dos pistas en paralelo (Opus para arquitectura y backend, Sonnet para UI): [docs/plan/](docs/plan/README.md).

| Fase | Release |
|---|---|
| 1 · Cimientos | 0.1.0 |
| 2 · Identidad y hogar | 0.2.0 |
| 3 · Movimientos | 0.3.0 |
| 4 · Planificación | 0.4.0 |
| 5 · Hogar compartido | 0.5.0 |
| 6 · Lanzamiento | 1.0.0 |
| 7 · Asistente IA | 1.1.0 |

## Documentación
- [Plan de desarrollo](docs/plan/README.md) y [protocolo de trabajo](docs/plan/PROTOCOLO.md)
- [Decisiones técnicas (ADR)](docs/adr/)
- [Features](docs/features/) · [Diseño](docs/design/)
- [De Android/iOS a React Native](docs/learning/android-ios-a-react-native.md)
