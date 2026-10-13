---
description: Ejecuta una tarea del plan de iCount (p. ej. /tarea A-1.1 o /tarea 1.0)
argument-hint: <ID de tarea>
---

Ejecuta la tarea **$ARGUMENTS** del plan de iCount.

1. Lee `CLAUDE.md` y `docs/plan/PROTOCOLO.md`. Localiza la sección de la tarea con `grep -n "$ARGUMENTS ·" docs/plan/fase-*.md` y lee **solo esa sección** (de su `##`/`###` al siguiente).
2. Comprueba que estás en la carpeta de tu pista (A → `iCount`, B → `iCount-b`) y que todas sus dependencias están marcadas `[x]` en `origin/develop` (haz `git fetch origin` antes). Crea la rama con `git switch -c feature/<id>-<slug> origin/develop`; nunca hagas `git checkout develop` en `iCount-b`. Si falta algo, **para y dímelo** sin escribir código.
3. Sigue los "Pasos de cualquier tarea" del protocolo y el **Prompt** de la sección. Respeta estrictamente los **ficheros exclusivos**.
4. Antes de usar cualquier API de Expo o React Native, consulta la documentación versionada (ver `mobile/AGENTS.md`).
5. Termina con: casilla `[x]` marcada, verificación en verde, PR abierto a `develop` y un resumen de 5 líneas (qué se hizo, PR, decisiones, pendientes, siguiente tarea de tu pista).
