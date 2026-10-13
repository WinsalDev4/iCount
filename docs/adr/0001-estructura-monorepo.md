# ADR-0001: Monorepo con `mobile/`, `backend/` y `docs/`

- **Estado:** Aceptado
- **Fecha:** 2026-10-13

## Contexto
iCount tiene una app móvil y tendrá un backend. Es un proyecto de portfolio desarrollado por una persona: se quiere ver todo el sistema en un único repositorio y versionar juntos los cambios que tocan app y API.

## Opciones consideradas
1. **Polyrepo** (un repo por pieza) — aislamiento total, pero cambios coordinados en varios PR y el portfolio queda fragmentado.
2. **Monorepo simple por carpetas** — un repo, cada proyecto con su propio `package.json`/build.
3. **Monorepo con workspaces / Turborepo / Nx** — paquetes compartidos y caché de builds, más configuración.

## Decisión
Monorepo simple por carpetas (opción 2). La carpeta de la app se llama `mobile/` y no `app/` porque Expo Router usa `src/app/` para las rutas y `app/src/app` sería confuso.

## Por qué
- Un único sitio que enseñar en el portfolio y un historial de Git coherente.
- Sin coste de tooling mientras no haya código que compartir (YAGNI).

## Consecuencias
- Cuando exista el backend en TypeScript, se podrá evolucionar a **npm workspaces** con un paquete `packages/contracts` (esquemas Zod compartidos entre API y app). Eso será un ADR nuevo.
- El CI filtra por rutas (`paths:`) para no ejecutar la app cuando solo cambia el backend.

## Para la entrevista
"Monorepo porque es un sistema con un único equipo y despliegues relacionados; empecé sin tooling de workspaces para no pagar complejidad antes de tener código compartido, y dejé preparado el camino a workspaces para compartir contratos tipados entre API y cliente."
