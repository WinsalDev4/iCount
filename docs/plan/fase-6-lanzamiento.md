# Fase 6 · Lanzamiento → release 1.0.0

**Objetivo:** backend desplegado, app segura, pulida y rápida, y builds de tienda generados con EAS. Al acabar, iCount está en pruebas internas (TestFlight o Play Internal testing) y el repo luce como pieza de portfolio.

> **Acciones del usuario antes de 6.0:** crear una cuenta en expo.dev; opcionalmente, Apple Developer Program (99 USD/año, necesario para iOS en dispositivo y TestFlight) y Google Play Console (25 USD, pago único).

---

## [ ] 6.0 · Preparación — Opus, en solitario
- **Rama:** `feature/6.0-preparacion-lanzamiento` · **Depende de:** fase 5 ✅
- **Hecho cuando:**
  - ADR-0018 (hosting): plataforma para la API y PostgreSQL gestionado, entornos de staging y producción, y coste estimado.
  - ADR-0019 (observabilidad): Sentry en app y backend, y logs estructurados.
  - `npx eas-cli@latest init` hecho con el usuario (projectId en `app.json`); variables `EXPO_PUBLIC_API_URL` por perfil en `eas.json`.
  - Dependencias: `@sentry/react-native`, `expo-localization`, `i18n-js` (o la librería que se decida); backend `@sentry/nestjs` y `helmet`.
    - ✅ **Hecho en G.0 (parte técnica):** `expo-localization` (plugin con `es` y `en`), `i18n-js` y `helmet`.
    - ⏳ **Pendiente en esta 6.0:** ADR-0018, ADR-0019, `eas init` con la cuenta del usuario, `EXPO_PUBLIC_API_URL` por perfil en `eas.json` y Sentry (`@sentry/react-native`, `@sentry/nestjs`), que depende de ADR-0019.
  - Fase 6 → 🚧.
- **Prompt:**
```
Tarea 6.0 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Prepara el lanzamiento según docs/plan/fase-6-lanzamiento.md: ADR-0018 (hosting API + Postgres gestionado, staging/prod, costes; compara 2–3 opciones actuales) y ADR-0019 (Sentry + logs). Guíame para ejecutar eas init con mi cuenta y configura env por perfil en eas.json. Instala dependencias (Sentry con su config plugin según la doc de SDK 57, expo-localization, i18n; helmet y Sentry en backend). Marca estados.
```

---

## Pista A · Opus

### [ ] A-6.1 · Despliegue y CD del backend
- **Rama:** `feature/a-6.1-despliegue` · **Depende de:** 6.0
- **Ficheros exclusivos:** `backend/**`, `.github/workflows/backend-*.yml`, `docs/backend/despliegue.md`
- **Hecho cuando:** Dockerfile multi-stage; migraciones al desplegar; staging se despliega desde `develop` y producción desde los tags `v*`; secretos en la plataforma y en GitHub; health check; runbook de *rollback*.
- **Prompt:**
```
Tarea A-6.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Despliega el backend según ADR-0018: Dockerfile multi-stage, migraciones en el arranque del despliegue, workflows de CD (develop→staging, tags v*→producción), secretos, health checks y un runbook de rollback en docs/backend/despliegue.md. Dime exactamente qué secretos tengo que crear yo.
```

### [ ] A-6.2 · Seguridad y resiliencia
- **Rama:** `feature/a-6.2-seguridad` · **Depende de:** A-6.1
- **Ficheros exclusivos:** `backend/**`, `mobile/src/core/**`, `docs/architecture/seguridad.md`
- **Hecho cuando:** revisión de autorización en todos los endpoints con tests; `helmet`, CORS, límites de tamaño y de peticiones; `npm audit` resuelto; checklist OWASP MASVS para la app (almacenamiento seguro, sin secretos en el bundle, logs sin datos personales); Sentry conectado en app y backend sin datos personales.
- **Prompt:**
```
Tarea A-6.2 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Pasada de seguridad: tests de autorización (un usuario nunca accede a otro hogar) en todos los endpoints, helmet/CORS/límites, npm audit, checklist OWASP MASVS aplicada a la app, y Sentry en app y backend sin PII (scrubbing). Ejecuta también /security-review. Documenta hallazgos y mitigaciones en docs/architecture/seguridad.md.
```

---

## Pista B · Sonnet

### [ ] B-6.1 · Pulido de producto
- **Rama:** `feature/b-6.1-pulido` · **Depende de:** 6.0
- **Ficheros exclusivos:** `mobile/assets/**`, `mobile/src/shared/**`, `mobile/src/features/*/presentation/**`, `docs/features/pulido.md`
- **Hecho cuando:** icono y splash con estética Midnight Glass; estados vacío, cargando y error en todas las pantallas; pasada de accesibilidad (etiquetas, tamaño de texto dinámico, contraste, orden de foco); *haptics* coherentes; textos externalizados para i18n (es, y en como segundo idioma).
- **Prompt:**
```
Tarea B-6.1 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Pulido de producto: icono y splash coherentes con Midnight Glass (genera los assets como SVG/PNG en mobile/assets y configúralos según la doc de SDK 57; si app.json necesita cambios, anótalos para 6.9), estados vacío/cargando/error en todas las pantallas, pasada de accesibilidad (labels, Dynamic Type, contraste, foco), haptics coherentes, y externaliza todos los textos para i18n (es + en). docs/features/pulido.md.
```

### [ ] B-6.2 · Rendimiento
- **Rama:** `feature/b-6.2-rendimiento` · **Depende de:** B-6.1
- **Ficheros exclusivos:** `mobile/src/shared/**`, `mobile/src/features/*/presentation/**`, `docs/features/rendimiento.md`
- **Hecho cuando:** medición antes y después (arranque en frío, FPS en listas y animaciones, re-renders); FlashList afinada; animaciones de Reanimated en el hilo de UI; *fallback* del desenfoque en Android de gama baja; resultados documentados.
- **Prompt:**
```
Tarea B-6.2 de iCount (sigue docs/plan/PROTOCOLO.md; pista B, Sonnet).
Pasada de rendimiento en build de release Android: mide arranque en frío, FPS en Historial y animaciones, y re-renders (React DevTools Profiler). Optimiza (FlashList, memoización donde se demuestre, worklets de Reanimated, fallback de BlurView en gama baja) y documenta antes/después en docs/features/rendimiento.md.
```

---

## [ ] 6.9 · Release 1.0.0 — Opus, en solitario
- **Hecho cuando:** cambios de `app.json` anotados por B aplicados; builds `production` de EAS para Android e iOS; envío a pruebas internas; README de portfolio con capturas o GIF, arquitectura y enlaces a los ADR; tag `v1.0.0`; fase 6 → ✅.
- **Prompt:**
```
Tarea 6.9 de iCount (sigue docs/plan/PROTOCOLO.md; pista A, Opus).
Cierra el MVP: aplica cambios pendientes de app.json, genera builds production con EAS (Android y, si tengo cuenta Apple, iOS) y guíame en el envío a pruebas internas. Rehaz el README raíz como pieza de portfolio (capturas, diagrama de arquitectura, decisiones clave con enlaces a ADR, cómo ejecutarlo). Marca la fase 6 ✅ y publica la release 1.0.0.
```
