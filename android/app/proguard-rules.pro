# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# React Native NetInfo - Network detection native module
-keep class com.reactnativecommunity.netinfo.** { *; }

# React Native Config - Environment variables native module
# Keep all classes in both possible package names
-keep class com.lugg.ReactNativeConfig.** { *; }
-keep class com.lugg.RNCConfig.** { *; }

# Keep the native module class and all its methods
-keepclassmembers class com.lugg.ReactNativeConfig.ReactNativeConfigModule {
    <methods>;
}

# Keep React Native TurboModule interface for react-native-config
-keep interface com.lugg.ReactNativeConfig.** { *; }

# React Native Config - BuildConfig class (contains all .env variables)
# CRITICAL: Without this, ProGuard renames BuildConfig and env vars are inaccessible
-keep class dev.souschef.app.BuildConfig { *; }
-keepclassmembers class dev.souschef.app.BuildConfig {
    public static <fields>;
}

# R8-specific aggressive rules for react-native-config
# Prevent any shrinking, optimization, or obfuscation of these classes
-keepnames class com.lugg.ReactNativeConfig.** { *; }
-keepnames class com.lugg.RNCConfig.** { *; }
-keepnames class dev.souschef.app.BuildConfig { *; }

# Suppress warnings for react-native-config
-dontwarn com.lugg.ReactNativeConfig.**
-dontwarn com.lugg.RNCConfig.**

# ============================================================================
# REACT NATIVE CORE - Essential rules for RN with New Architecture
# ============================================================================

# JSI (JavaScript Interface) - Critical for New Architecture
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.jsi.** { *; }

# TurboModules (New Architecture Native Modules)
-keep class com.facebook.react.turbomodule.** { *; }
-keep interface com.facebook.react.turbomodule.** { *; }

# Fabric (New Architecture Renderer)
-keep class com.facebook.react.fabric.** { *; }
-keep interface com.facebook.react.fabric.** { *; }

# Hermes Engine
-keep class com.facebook.hermes.** { *; }

# React Native ProGuard annotations - DO NOT STRIP
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.proguard.annotations.KeepGettersAndSetters *;
}
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keep @com.facebook.proguard.annotations.KeepGettersAndSetters class *

# Keep native methods (standard Android rule)
-keepclassmembers class * {
    native <methods>;
}

# Prevent obfuscation of classes with native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# ============================================================================
# Note: Most React Native libraries (Reanimated, Vision Camera, MMKV, etc.)
# auto-include their ProGuard rules via consumerProguardFiles.
# Only add library-specific rules here if you encounter crashes.
# ============================================================================
