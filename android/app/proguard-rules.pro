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
-keep class com.lugg.ReactNativeConfig.** { *; }

# React Native Config - BuildConfig class (contains all .env variables)
# CRITICAL: Without this, ProGuard renames BuildConfig and env vars are inaccessible
-keep class dev.souschef.app.BuildConfig { *; }