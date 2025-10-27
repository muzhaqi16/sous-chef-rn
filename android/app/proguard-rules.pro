# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# React Native NetInfo - Prevent stripping network detection module
-keep class com.reactnativecommunity.netinfo.** { *; }
-keepclassmembers class com.reactnativecommunity.netinfo.** { *; }

# React Native Config - Prevent stripping environment variable module
-keep class com.lugg.ReactNativeConfig.** { *; }
-keepclassmembers class com.lugg.ReactNativeConfig.** { *; }

# Apollo Client / GraphQL - Keep generated types and operations
-keep class ** implements com.apollographql.apollo.api.** { *; }
-keepclassmembers class ** implements com.apollographql.apollo.api.** { *; }
