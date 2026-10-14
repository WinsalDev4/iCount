---
description: Muestra el estado del plan y la siguiente tarea de cada pista
---

Sin modificar nada:

1. Lee la tabla de estado de `docs/plan/README.md` e identifica la fase en curso (🚧), o la siguiente pendiente.
2. En el fichero de esa fase, lista las tareas con su casilla (`[ ]` / `[x]`).
3. Comprueba con `git log origin/develop --oneline -20` qué se ha integrado ya (ya no se usan PR).
4. Responde en una tabla breve:
   - Fase en curso y su progreso.
   - **Siguiente tarea para la pista A (Opus)** y **para la pista B (Sonnet)**: la primera no hecha cuyas dependencias estén cumplidas, o "bloqueada por X".
   - El comando exacto a pegar en cada sesión (`/tarea <ID>`).
