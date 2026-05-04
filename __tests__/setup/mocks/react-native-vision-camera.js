'use no memo';
jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCameraDevice: jest.fn(() => null),
  useCameraDevices: jest.fn(() => []),
  useCameraPermission: jest.fn(() => ({
    hasPermission: true,
    requestPermission: jest.fn(),
  })),
  usePhotoOutput: jest.fn(() => ({
    capturePhoto: jest.fn(),
    capturePhotoToFile: jest.fn(),
  })),
}));

jest.mock('react-native-vision-camera-barcode-scanner', () => ({
  useBarcodeScannerOutput: jest.fn(() => ({})),
  useBarcodeScanner: jest.fn(() => ({ scanCodes: jest.fn(() => []) })),
}));
