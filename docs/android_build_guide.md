# Android Build Guide

This guide explains how to package your Expo app for Android.

## Prerequisites

1.  **EAS CLI**: Ensure you have the Expo Application Services CLI installed.
    ```bash
    npm install -g eas-cli
    ```
2.  **Expo Account**: You need an Expo account. Run `eas login` to log in.

## Configuration

Your `app.json` must have an `android.package` defined. This is a unique identifier for your app on the Play Store (e.g., `com.yourname.projectname`).

## Building the App

### 1. Configure EAS
Initialize the EAS build configuration. This will create an `eas.json` file.
```bash
eas build:configure
```
Select `Android` when prompted.

### 2. Create the Build
To create a build that you can install on your emulator or device (APK):
```bash
eas build -p android --profile development
```
Or for a production bundle (AAB) for the Play Store:
```bash
eas build -p android --profile production
```

### 3. Build for Testing (APK)
To create an installable `.apk` file for your device (sideloading):
```bash
npx eas-cli build --platform android --profile preview
```
*Note: We configured the `preview` profile in `eas.json` to output an APK.*

### 3. install on Emulator
If you built a development build (APK), you can drag and drop the downloaded file onto your Android Emulator to install it.

## Local Build (Advanced)
If you want to build locally without using EAS cloud services (requires Android Studio):
```bash
npx expo run:android
```

## Running on Android Emulator

If you want to run the app on an Android emulator locally:

1.  **Locate the Emulator**: The emulator is typically located at `~/Library/Android/sdk/emulator/emulator`.
2.  **List AVDs**: Check available Android Virtual Devices:
    ```bash
    ~/Library/Android/sdk/emulator/emulator -list-avds
    ```
3.  **Start Emulator**: Run a specific AVD (e.g., `Medium_Phone_API_36.0`):
    ```bash
    ~/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_36.0
    ```
4.  **Run the App**: Once the emulator is running and connected (verify with `adb devices`), start the app:
    ```bash
    npm run android
    ```
