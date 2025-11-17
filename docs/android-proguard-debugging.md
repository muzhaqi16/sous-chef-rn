# Android ProGuard Debugging Guide

This guide helps diagnose and fix crashes when ProGuard/R8 code shrinking is enabled in release builds.

## Prerequisites

- Android device or emulator connected
- ADB installed and accessible
- Project dependencies installed (`yarn install`)

## Step 1: Build Staging APK with ProGuard

The staging build has ProGuard enabled but uses the debug keystore, making it easy to test locally.

```bash
# Clean previous builds
cd android && ./gradlew clean && cd ..

# Build staging APK (ProGuard enabled)
cd android && ./gradlew assembleStaging or ./gradlew assembleRelease
```

The APK will be generated at:

```
android/app/build/outputs/apk/staging/app-universal-staging.apk
```

## Step 2: Install APK on Device

```bash
# List connected devices
adb devices

# Install the APK (universal build)
adb install -r android/app/build/outputs/apk/staging/app-universal-staging.apk

# Or for a specific device
adb -s <device_id> install -r android/app/build/outputs/apk/staging/app-universal-staging.apk
```

## Step 3: Capture Crash Logs

### Clear logs and monitor in real-time

```bash
# Clear existing logs
adb logcat -c

# Monitor for crashes (filtered for relevant tags)
adb logcat *:E | grep -E "(FATAL|AndroidRuntime|souschef|ReactNative)"
```

### Alternative: Full crash log

```bash
# Get all error-level logs
adb logcat *:E

# Or specifically for fatal exceptions
adb logcat AndroidRuntime:E *:S
```

### Save logs to file

```bash
adb logcat -d > crash_log.txt
```

## Step 4: Analyze the Crash

Common ProGuard-related crash patterns:

### 1. ClassNotFoundException

```
java.lang.ClassNotFoundException: com.example.SomeClass
```

**Fix:** Add keep rule for the class

### 2. NoSuchMethodError

```
java.lang.NoSuchMethodError: No virtual method someMethod()
```

**Fix:** Keep class members

### 3. NoSuchFieldError

```
java.lang.NoSuchFieldError: No field someField
```

**Fix:** Keep fields from obfuscation

### 4. Native method not found

```
java.lang.UnsatisfiedLinkError: No implementation found for native
```

**Fix:** Keep native method declarations

## Step 5: Common ProGuard Rules for React Native Libraries

### React Native Reanimated

```proguard
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
```

### React Native Vision Camera

```proguard
-keep class com.mrousavy.camera.** { *; }
-keep class com.facebook.jni.** { *; }
```

### React Native MMKV

```proguard
-keep class com.tencent.mmkv.** { *; }
-keep class com.reactnativemmkv.** { *; }
```

### React Native Unistyles (Nitro Modules)

```proguard
-keep class com.margelo.nitro.** { *; }
-keep class com.reactnativeunistyles.** { *; }
```

### React Native Worklets

```proguard
-keep class com.swmansion.worklets.** { *; }
```

## Step 6: Add Missing Rules

Edit `android/app/proguard-rules.pro` and add the necessary keep rules based on your crash analysis.

## Debugging Tips

### Enable ProGuard mapping file

The mapping file helps decode obfuscated stack traces:

```
android/app/build/outputs/mapping/staging/mapping.txt
```

### Disable optimization temporarily

To isolate if it's a shrinking vs optimization issue, add to `proguard-rules.pro`:

```proguard
-dontoptimize
```

### Keep all classes temporarily (nuclear option)

If you need to verify it's a ProGuard issue:

```proguard
-keep class ** { *; }
-dontshrink
-dontobfuscate
```

### Check library consumer rules

Most React Native libraries include their own ProGuard rules. Check if they're being applied:

```bash
ls node_modules/<library>/android/proguard-rules.pro
```

## Quick Reference Commands

```bash
# Build and install in one go
cd android && ./gradlew assembleStaging && cd .. && adb install -r android/app/build/outputs/apk/staging/app-universal-staging.apk

# Monitor crash with app launch
adb logcat -c && adb shell am start -n dev.souschef.app/.MainActivity && adb logcat *:E

# Get just the crash stack trace
adb logcat -d | grep -A 50 "FATAL EXCEPTION"
```

## After Fixing

Once you've added the necessary ProGuard rules:

1. Rebuild the staging APK
2. Test the app thoroughly
3. Run typecheck and lint: `npm run typecheck && npm run lint`
4. Commit the updated `proguard-rules.pro`
