# Entorno de desarrollo (Windows 11)

Estado del equipo configurado el 2026-10-13.

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 24.x | Runtime de Metro, Expo CLI, Jest |
| npm | 11.x | Gestor de paquetes (usar `npx expo install` para libs de la app) |
| Git + git-flow (AVH) | 2.45 / 1.12 | Control de versiones, [Git Flow](../adr/0005-git-flow.md) |
| GitHub CLI (`gh`) | 2.97 | Repos, PRs |
| JDK | Microsoft OpenJDK 17 | Compilar Android con Gradle (versión recomendada por React Native) |
| Android SDK | API 36, build-tools 36 | `%LOCALAPPDATA%\Android\Sdk` |
| Android cmdline-tools | latest | `sdkmanager`, `avdmanager` |
| Emuladores | Pixel 8a, Pixel 10 Pro XL | Pruebas |

## Variables de entorno (usuario)

```
JAVA_HOME     = C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot   (la fija el instalador, a nivel de sistema)
ANDROID_HOME  = %LOCALAPPDATA%\Android\Sdk
PATH         += %ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%ANDROID_HOME%\cmdline-tools\latest\bin
```

Tras cambiarlas, **cierra y vuelve a abrir** terminales y el IDE para que las lean.

> Hay un Java 8 de Oracle instalado (`java8path`) que no se ha tocado; el JDK 17 está antes en el `PATH` del sistema, así que es el que se usa.
> El JDK se instaló con `winget install Microsoft.OpenJDK.17` y las cmdline-tools se descargaron de `dl.google.com` a `%ANDROID_HOME%\cmdline-tools\latest`.

## Comprobación

```bash
java -version          # 17.x
adb --version
emulator -list-avds
cd mobile && npx expo-doctor
```

## Ejecutar la app

```bash
cd mobile
npm start              # Metro bundler
npm run android        # compila un development build y lo instala en el emulador
```

La primera compilación de Android tarda varios minutos (Gradle descarga NDK, CMake y dependencias).

### iOS desde Windows
No se puede compilar iOS en local sin macOS. Opciones:
- **EAS Build** (`npx eas-cli@latest build --platform ios --profile development`) compila en la nube.
- Probar en un iPhone físico con el development build instalado desde EAS.

## Editor recomendado
VS Code con: ESLint, Prettier, Expo Tools, React Native Tools. (Android Studio sigue siendo útil para el emulador, Logcat y el Layout Inspector.)
