# ADR-0008: Testing y calidad — Jest, Testing Library, ESLint, Prettier, CI

- **Estado:** Aceptado
- **Fecha:** 2026-10-13

## Decisión
| Capa | Herramienta | Qué se testea |
|---|---|---|
| Dominio (casos de uso, value objects) | Jest (`jest-expo`) | Lógica pura, sin React. Mayoría de tests |
| ViewModels | `renderHook` de `@testing-library/react-native` | Transiciones `loading → success/error` con dependencias falsas |
| Pantallas | `render` + queries por rol/texto | Comportamiento visible para el usuario, no detalles internos |
| E2E (futuro) | Maestro | Flujos críticos: alta de gasto, invitar a la economía compartida |

Calidad estática: ESLint (`eslint-config-expo` + `eslint-config-prettier`), Prettier, TypeScript 6 en modo `strict` + `noUncheckedIndexedAccess`.
CI: GitHub Actions (`.github/workflows/mobile-ci.yml`) ejecuta lint, typecheck, formato y tests en cada push/PR.

## Por qué
- Pirámide de tests: el valor está en el dominio y es lo más barato de testear.
- Testing Library fomenta testear como usa la app el usuario (equivalente a Compose UI Test / ViewInspector).
- Maestro: E2E con YAML, funciona igual en Android e iOS y es más estable que Detox para empezar.

## Notas
- TypeScript 6 ya no incluye automáticamente todos los `@types/*`: por eso `tsconfig.json` declara `"types": ["jest"]`.

## Para la entrevista
"Testeo la lógica en el dominio con tests unitarios puros, los ViewModels con renderHook inyectando dependencias falsas por Context, y reservo E2E con Maestro para los flujos de negocio críticos."
