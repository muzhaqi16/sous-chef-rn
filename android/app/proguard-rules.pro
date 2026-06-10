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

# BuildConfig class
# CRITICAL: Without this, ProGuard renames BuildConfig and fields read via
# reflection become inaccessible
-keep class dev.souschef.app.BuildConfig { *; }

# React native skia
-keep class com.shopify.reactnative.skia.** { *; }

# React Native Device Info - Device information native module
# Required to prevent obfuscation of device info methods
-keep class com.learnium.RNDeviceInfo.** { *; }

# react-native-nitro-modules + react-native-vision-camera + vision-camera-barcode-scanner
# Nitro instantiates Hybrid* classes via reflection by FQCN
# (e.g. com.margelo.nitro.camera.HybridFrameConverter). Without these rules R8
# strips/renames them and NitroModulesProxy.createHybridObject throws
# ClassNotFoundException at runtime in release builds.
-keep class com.margelo.nitro.** { *; }
-keepclassmembers class com.margelo.nitro.** { *; }