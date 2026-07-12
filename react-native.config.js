module.exports = {
  dependencies: {
    // iOS uses VisionCamera's built-in useObjectOutput (native
    // AVCaptureMetadataOutput), so we skip this package's iOS pod
    // to avoid pulling in the Google MLKit pods. MLKit ships only
    // device-arm64 + x86_64-simulator slices, which fails to link
    // against iOS 26.x simulators (arm64-only). Android still uses
    // this package via Platform.OS dispatch in BarcodeScannerScreen.
    'react-native-vision-camera-barcode-scanner': {
      platforms: { ios: null },
    },
    // iOS push uses APNs directly (no Firebase) — see
    // docs/push-setup-checklist.md. Firebase messaging is Android-only here:
    // every entry point in src/services/push/native* is Android-guarded
    // (Platform.OS !== 'android'). Skip the iOS pods so autolinking doesn't
    // pull in FirebaseCoreInternal / GoogleUtilities, which fail `pod install`
    // under static libraries with the "Swift pod depends on GoogleUtilities,
    // which does not define modules" modular-headers error. Android still
    // links both via autolinking.
    '@react-native-firebase/app': {
      platforms: { ios: null },
    },
    '@react-native-firebase/messaging': {
      platforms: { ios: null },
    },
  },
};
