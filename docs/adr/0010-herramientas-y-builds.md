# ADR-0010: VS Code como editor y EAS Build para compilar (iOS desde Windows)

- **Estado:** Aceptado
- **Fecha:** 2026-10-13

## Contexto
El equipo es Windows. Hay que decidir el editor y cómo generar builds de Android e iOS.

## Decisión
- **Editor: VS Code**, con la configuración del repo (`.vscode/settings.json`) y extensiones recomendadas (`.vscode/extensions.json`): ESLint, Prettier, Expo Tools, React Native Tools, EditorConfig y Jest.
- **Android Studio** solo como gestor del SDK y del emulador, Logcat y Layout Inspector.
- **Builds con EAS** (`mobile/eas.json`):

| Perfil | Para qué | Comando |
|---|---|---|
| `development` | App con dev client en dispositivo real | `npm run build:ios:dev` / `npm run build:android:dev` |
| `development-simulator` | Dev client para simulador iOS (útil solo con Mac) | `npx eas-cli@latest build -p ios --profile development-simulator` |
| `preview` | Probar en dispositivos sin herramientas de desarrollo | `npm run build:preview` |
| `production` | Tiendas (versión autoincrementada en remoto) | `npx eas-cli@latest build -p all --profile production` |

- En local, Android: `npm run android` (compila con Gradle y abre el emulador).

## Requisitos para iOS (importante)
- Cuenta gratuita de Expo (`npx eas-cli@latest login`) y, la primera vez, `npx eas-cli@latest init` para vincular el proyecto.
- **Instalar en un iPhone físico requiere el Apple Developer Program de pago (99 USD/año)**: la distribución interna usa provisioning *ad hoc*. Se registra el iPhone con `npx eas-cli@latest device:create`.
- Sin cuenta de Apple de pago: se puede iterar en Android y validar iOS más tarde; Expo Go en el iPhone sirve solo mientras no haya módulos nativos que no incluya.

## Por qué
- VS Code es el editor de facto del ecosistema JS/TS: mejor integración de TypeScript, ESLint y Expo que Android Studio.
- EAS compila iOS en macOS en la nube y gestiona certificados y perfiles de aprovisionamiento automáticamente.

## Para la entrevista
"Desarrollo en Windows y compilo iOS con EAS Build en la nube: gestiona la firma y los perfiles de aprovisionamiento. Tengo perfiles separados para development (dev client), preview (QA interno) y production con versión autoincrementada en remoto."
