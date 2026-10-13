# ADR-0011: npm workspaces y paquetes compartidos sin paso de build

- **Estado:** Aceptado
- **Fecha:** 2026-10-13
- **Sustituye a:** [ADR-0001](0001-estructura-monorepo.md) (en lo relativo a "monorepo simple por carpetas")

## Contexto
Con la fase 1 llega el backend (NestJS) y un paquete de contratos (`@icount/contracts`, esquemas zod) que deben usar **a la vez** la app (Metro, Jest) y la API (Node, Vitest). ADR-0001 dejó previsto el paso a workspaces "cuando hubiera código que compartir". Ya lo hay.

Restricciones:
- Expo SDK 57 configura Metro solo para monorepos (desde SDK 52) si no se toca `watchFolders` ni `nodeModulesPaths` ([guía de monorepos](https://docs.expo.dev/guides/monorepos/)).
- Una app React Native **no admite dos copias de React** ni de módulos nativos.
- Nest CLI 12 genera un proyecto **ESM** con Vitest y oxlint; la app usa Jest (`jest-expo`) y ESLint (`expo lint`).
- Proyecto de una persona: el *tooling* debe ser mínimo.

## Opciones consideradas
1. **Seguir con carpetas independientes** y copiar o publicar los contratos — sin configuración, pero duplicación o un registro privado para un solo consumidor.
2. **npm workspaces** — nativo de npm (ya lo usamos), un lockfile, enlaces simbólicos entre paquetes. Sin caché de tareas.
3. **npm workspaces + Turborepo/Nx** — caché y orquestación de tareas; configuración extra que hoy no amortiza (3 paquetes, CI de pocos minutos).
4. **pnpm o Bun workspaces** — instalación aislada más estricta; cambia el gestor de paquetes y algunas librerías RN aún fallan con dependencias aisladas.

Y para los paquetes internos:
- **a) Con build** (`tsc` → `dist/`): funciona en cualquier sitio, pero hay que compilar antes de usar y vigilar que `dist/` no quede obsoleto.
- **b) Sin build** (`exports` → `src/index.ts`): cada consumidor lee TypeScript directamente.

## Decisión
**npm workspaces** (`mobile`, `backend`, `packages/*`) con un único `package-lock.json` en la raíz, y **paquetes internos sin paso de build** (opción b).

Cómo encaja cada herramienta con `@icount/contracts` (TS fuente):

| Consumidor | Cómo lee el `.ts` | Ajuste necesario |
|---|---|---|
| App (Metro) | Metro transpila con Babel todo lo que resuelve; detecta el monorepo solo | Ninguno: **sin `metro.config.js`** |
| App (Jest, `jest-expo`) | El enlace simbólico apunta fuera de `node_modules`, así que Babel lo transforma | Ninguno |
| App (`tsc`) | Lo comprueba como código fuente | `allowImportingTsExtensions` (la app no emite JS) |
| Backend (`tsc`/`nest build`) | Lo comprueba pero no lo emite (es una librería externa) | `rewriteRelativeImportExtensions` |
| Backend (Node 24 en ejecución) | *Type stripping* nativo de Node (el paquete es ESM) | Ninguno |
| Backend y contratos (Vitest) | Vite transforma TS y ESM sin configuración | Ninguno |

Reglas que impone en `packages/*`:
- Solo **TypeScript borrable** (`erasableSyntaxOnly`): nada de `enum`, `namespace` ni *parameter properties*. Node elimina los tipos, no los compila. En lugar de `enum`, usar `z.enum([...])` o uniones de literales.
- Imports relativos **con extensión `.ts`** (`export * from './apiVersion.ts'`), como exige ESM en Node.
- `verbatimModuleSyntax`: los imports de solo tipos se escriben `import type`.

Otras decisiones:
- **Una sola versión de React:** `overrides` en el `package.json` raíz fija `react` y `react-dom` a la versión de la app. Sin él, un *peer* de Testing Library (`react-reconciler`) arrastraba `react@19.3.0` a la raíz y dejaba la app con dos Reacts.
- **Ejecutor de tests:** la app sigue con Jest (`jest-expo` es el *preset* oficial de React Native); backend y contratos usan **Vitest**, que es lo que genera Nest 12 y entiende ESM + TypeScript sin transformadores. La API (`describe`/`it`/`expect`) es la misma. El plan pedía Jest en contratos; Vitest evita configurar `ts-jest` con ESM y deja una sola herramienta en el lado Node.
- **Lint:** ESLint en la app (`expo lint`) y oxlint con reglas de tipos en backend y contratos (lo que trae Nest 12; muy rápido).
- **Formato:** Prettier con `.prettierrc.json` en la raíz (la app conserva su copia idéntica).

## Por qué
- Cero herramientas nuevas: npm ya estaba, y Expo, Nest y Vitest entienden workspaces de serie.
- Sin build intermedio no hay `dist/` desfasado ni paso extra en CI; un cambio en un contrato lo ven la app y la API al instante (y `tsc` avisa en ambos lados si se rompe).
- Node 24 ya ejecuta TypeScript borrable: lo que hace dos años exigía webpack o un build, hoy es nativo.

## Consecuencias
- `npm install` **siempre en la raíz**. Las dependencias de un paquete se añaden con `-w`: `npm install <pkg> -w @icount/backend`. Las de la app, con `npx expo install <pkg>` desde `mobile/` (Expo detecta el workspace).
- Al subir de SDK de Expo hay que actualizar a la vez `react` en `mobile/package.json` y en `overrides`.
- El CI instala desde la raíz (`npm ci`) y filtra por rutas: `mobile-ci` también se ejecuta si cambia `packages/**`; `contracts-ci` valida el paquete de contratos.
- Si algún día un consumidor no puede leer TS (otro runtime, publicar en npm), se añade un build a ese paquete concreto sin cambiar su API.
- Turborepo sigue siendo una opción futura si el CI se vuelve lento.

## Para la entrevista
"Pasé a npm workspaces cuando apareció código compartido de verdad: un paquete de contratos zod que usan la app y la API. No le puse paso de build: Metro, Vitest y Node 24 leen TypeScript directamente, así que un cambio en un contrato rompe el `tsc` de los dos lados en el mismo PR. El precio es escribir TS 'borrable' (sin enums) e imports con extensión. Y vigilé lo típico de React Native en monorepos: una sola copia de React, forzada con `overrides`."

Analogía: es como un proyecto Gradle multimódulo (`:app`, `:backend`, `:contracts`) con `implementation(project(":contracts"))`, o un paquete local de Swift Package Manager. El módulo compartido se compila desde el código fuente, no desde un artefacto publicado.

Preguntas probables:
- *¿Por qué no Turborepo?* Hoy son tres paquetes y el CI tarda minutos; la caché de tareas no compensa su configuración. Se añade sin rehacer nada.
- *¿Qué pasa si se duplica React?* Errores en ejecución (*invalid hook call*). Se detecta con `npm ls react` y se evita con `overrides`.
- *¿Por qué no un `enum` en los contratos?* El *type stripping* de Node solo borra tipos; un `enum` genera código. Se usa `z.enum`, que además valida en ejecución.
