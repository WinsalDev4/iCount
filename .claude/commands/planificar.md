---
description: Planifica una idea nueva como fase del plan con el formato de dos pistas
argument-hint: <idea o feature a planificar>
---

Quiero planificar: **$ARGUMENTS**

1. Lee `CLAUDE.md`, `docs/plan/README.md`, `docs/plan/PROTOCOLO.md`, `docs/plan/backlog.md` y **un** fichero de fase como ejemplo de formato (`docs/plan/fase-3-movimientos.md`).
2. Hazme las preguntas imprescindibles para acotar la idea (alcance, usuarios, prioridad, pantallas). Si hace falta diseño, propón crear un lienzo con varias propuestas en la dirección Midnight Glass (ADR-0009).
3. Redacta la fase nueva con el mismo formato:
   - `X.0` (Opus): ADRs con número asignado, dependencias, contratos, puertos y módulos stub.
   - Tareas `A-X.n` (Opus) y `B-X.n` (Sonnet) con rama, dependencias, **ficheros exclusivos sin solapamientos entre pistas**, criterios de hecho y prompt específico.
   - `X.9` (Opus): integración y release.
4. Comprueba explícitamente que ninguna tarea A y B que puedan ir en paralelo comparten ficheros.
5. Trabaja en una rama `feature/plan-<slug>`: añade la fila de la fase a `docs/plan/README.md` y saca la idea del backlog. Abre un PR a `develop`.
