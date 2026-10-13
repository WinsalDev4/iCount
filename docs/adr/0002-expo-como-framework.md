# ADR-0002: Usar Expo (SDK 57) como framework de React Native

- **Estado:** Aceptado
- **Fecha:** 2026-10-13

## Contexto
Hay que elegir cómo arrancar un proyecto React Native. El equipo de desarrollo es Windows (no puede compilar iOS en local) y viene de nativo (Kotlin/Swift).

## Opciones consideradas
1. **React Native CLI "bare"** — control total de `android/` e `ios/`, pero mantenimiento manual de Gradle/Xcode, upgrades dolorosos.
2. **Expo** — framework oficialmente recomendado por la documentación de React Native. Continuous Native Generation (CNG), Expo Router, EAS Build en la nube, módulos nativos mantenidos.

## Decisión
Expo SDK 57 (React Native 0.86, React 19.2, New Architecture activada por defecto) con **development builds** (no Expo Go como entorno principal).

## Por qué
- **La doc de React Native recomienda empezar con un framework**, y Expo es el de referencia.
- **CNG**: `android/` e `ios/` se generan desde `app.json` + config plugins. No se versionan; los upgrades son cambiar la versión del SDK.
- **iOS sin Mac**: EAS Build compila en la nube y firma; desde Windows puedo generar builds de iOS.
- **Expo Router**: navegación basada en ficheros con rutas tipadas y deep links gratis.
- Si necesito código nativo propio (Kotlin/Swift), Expo Modules API permite escribir módulos nativos — aprovecho mi experiencia nativa.

## Consecuencias
- Nunca editar `android/` ni `ios/` a mano: configuración vía `app.json` y config plugins.
- Al añadir librerías con código nativo hay que regenerar el development build (`npx expo run:android` o `eas build --profile development`).
- Instalar dependencias con `npx expo install` para obtener versiones compatibles con el SDK.

## Para la entrevista
- **¿Expo Go vs development build?** Expo Go es una app genérica con un set fijo de módulos nativos; un development build es *tu* app con *tus* módulos nativos + el dev client. En producción siempre development/production builds.
- **¿Qué es la New Architecture?** JSI (llamadas síncronas JS↔nativo sin serializar JSON por el "bridge"), Fabric (nuevo renderer) y TurboModules (módulos nativos cargados bajo demanda y tipados con Codegen).
- **¿Qué es CNG?** Tratar los proyectos nativos como artefactos generados, igual que no versionas `build/` en Android.
