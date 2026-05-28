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
  },
};
