# Genesis OS // Android Production Deployment Guide
This document details the configuration, compile steps, signing, and device deployment workflow for the native Android build of **Genesis OS** (CartelWorx speed platform).

---

## 🚀 One-Click Sync & Native Build
We have pre-configured high-fidelity workspace scripts so that you can compile, sync, and bundle with a single command.

### 1. Prerequisites
Ensure you have the following components installed on your local compilation machine:
- **Node.js**: v18 or newer
- **Java Development Kit (JDK)**: JDK 17 (essential for Android Gradle Plugin 8.13.0+)
- **Android SDK**: Install command line tools or Android Studio, and configure the `$ANDROID_HOME` or `$ANDROID_SDK_ROOT` environment path.

### 2. Execution Command
From the root of the project workspace, trigger the fully unified build cycle:
```bash
# Clean, compile React code, sync native assets, run Gradle build
npm run android:sync
```
For local compiled packages, trigger:
```bash
# Build production web bundles, compile native android resources, and output Release APK
npm run android:build
```

---

## 🛠️ Step-by-Step Android Studio / CLI Build

If you are expanding native features or debugging on a simulated vehicle hardware emulator:

### 1. Synchronizing Web Resources
Ensure the current web assets are bundled and pushed to the Android sub-directory:
```bash
npm run build
npx cap sync android
```

### 2. Generating a Signed Release Bundle
To upload to private vehicle deployment servers or side-load on vehicle dashboard head units:

1. **Navigate to the Android directory**:
   ```bash
   cd android
   ```
2. **Build the Release APK**:
   ```bash
   ./gradlew assembleRelease
   ```
3. **Build the Google Play / App Bundle (AAB)**:
   ```bash
   ./gradlew bundleRelease
   ```

The output artifacts will be placed under:
* **APK**: `android/app/build/outputs/apk/release/app-release-unsigned.apk`
* **App Bundle**: `android/app/build/outputs/bundle/release/app-release.aab`

---

## 🔐 Keystore Signing Sequence (Production Prep)
Android requires all release-compiled packages to be cryptographically signed prior to installation on a physical device.

To sign your build using standard JDK CLI tools:

1. **Generate a Secure keystore (if not already possessed)**:
   ```bash
   keytool -genkey -v -keystore genesisos-release.keystore -alias genesis-alias -keyalg RSA -keysize 2048 -validity 10000
   ```
2. **Compress and Align the Unsigned APK**:
   ```bash
   zipalign -v 4 android/app/build/outputs/apk/release/app-release-unsigned.apk GenesisOS-Aligned.apk
   ```
3. **Secure Sign with Apksigner**:
   ```bash
   apksigner sign --keystore genesisos-release.keystore --out GenesisOS-Production.apk GenesisOS-Aligned.apk
   ```

Use `apksigner verify GenesisOS-Production.apk` to confirm that the package signature checks out perfectly.

---

## 📲 Physical Device Sideload and Head-Unit Installation
For racing hardware dashboards, car Android TV head units, or handheld tuning devices, follow these steps:

### Enable Developer Options
1. Go to **Settings** -> **About Device**.
2. Tap the **Build Number** 7 times continuously until a toast says `"You are now a developer"`.
3. Return to settings, enter **Developer Options**, and toggle **USB Debugging** to **ON**.

### Sideload via USB (ADB)
Ensure target device is connected to your development machine and run:
```bash
adb install -r GenesisOS-Production.apk
```

---

## 🔌 Hardware Permission Handshakes
To prevent runtime crashes and ensure zero-failure hardware connections, **Genesis OS** has been configured with highly specified, fine-tuned hardware definitions in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

When initializing, the applet will prompt for location and Bluetooth permissions. These are required to scan for **OBD-II BLE links**, pair with **ECU diagnostic dongles**, and record sub-meter **GPS track maps** during high-speed telemetry runs.
