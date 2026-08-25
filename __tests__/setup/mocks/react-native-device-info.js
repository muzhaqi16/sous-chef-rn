'use no memo';
jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '1'),
  getUniqueId: jest.fn(() => Promise.resolve('test-device-id')),
  getDeviceId: jest.fn(() => 'test-device'),
  getSystemName: jest.fn(() => 'iOS'),
  getSystemVersion: jest.fn(() => '17.0'),
  getBrand: jest.fn(() => 'Apple'),
  getModel: jest.fn(() => 'iPhone 15'),
  isEmulator: jest.fn(() => Promise.resolve(false)),
  isEmulatorSync: jest.fn(() => false),
  getApplicationName: jest.fn(() => 'SousChef'),
  getBundleId: jest.fn(() => 'com.souschef.app'),
}));
