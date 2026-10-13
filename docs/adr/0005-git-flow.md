# ADR-0005: Git Flow + Conventional Commits

- **Estado:** Aceptado
- **Fecha:** 2026-10-13

## Contexto
Las apps móviles se publican por versiones (revisión de App Store / Play Store), no en despliegue continuo. Se quiere un historial limpio y demostrable.

## Opciones consideradas
1. **GitHub Flow / trunk-based** — una rama principal + ramas cortas. Ideal para web con CD.
2. **Git Flow** — `main`, `develop`, `feature/*`, `release/*`, `hotfix/*`. Encaja con releases versionadas.

## Decisión
Git Flow con la extensión `git flow` (AVH, incluida en Git for Windows) y Conventional Commits.

| Rama | Sale de | Vuelve a | Uso |
|---|---|---|---|
| `main` | — | — | Código publicado. Cada merge = tag `vX.Y.Z` |
| `develop` | `main` | — | Integración de features |
| `feature/<nombre>` | `develop` | `develop` | Una funcionalidad |
| `release/<x.y.z>` | `develop` | `main` + `develop` | Estabilizar versión, subir versión en `app.json` |
| `hotfix/<x.y.z>` | `main` | `main` + `develop` | Arreglo urgente en producción |

```bash
git flow feature start add-transaction
# ... commits ...
git flow feature finish add-transaction   # merge --no-ff a develop

git flow release start 0.2.0
git flow release finish 0.2.0              # merge a main, tag, back-merge a develop
```

Commits: `feat(transactions): add monthly summary`, `fix: …`, `docs(adr): …`, `chore: …`, `refactor: …`, `test: …`.

## Por qué
- Los ciclos de release móvil (beta en TestFlight / Internal testing → producción) mapean directamente a ramas `release/*`.
- `hotfix/*` permite parchear producción sin arrastrar features a medias de `develop`.
- Conventional Commits permite generar changelogs y versionado semántico automáticamente.

## Consecuencias
- Más ramas que trunk-based. Con OTA updates (EAS Update) los hotfix de JS pueden publicarse sin pasar por la tienda.

## Para la entrevista
"En móvil uso Git Flow porque las publicaciones son por versión y pasan revisión; las ramas release me dan un sitio donde estabilizar mientras develop sigue avanzando. Si el producto fuese web con CD, elegiría trunk-based con feature flags."
