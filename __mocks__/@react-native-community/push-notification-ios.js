// Auto-applied Jest mock: the real module constructs a NativeEventEmitter at
// import time, which throws under Jest (no native module). This safe default
// surface lets any file that transitively imports it load cleanly. Tests that
// need to drive specific behavior override with an inline jest.mock factory.
module.exports = {
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    requestPermissions: jest.fn(() =>
      Promise.resolve({ alert: true, badge: true, sound: true }),
    ),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    setApplicationIconBadgeNumber: jest.fn(),
    getApplicationIconBadgeNumber: jest.fn(cb => cb && cb(0)),
    FetchResult: {
      NewData: 'UIBackgroundFetchResultNewData',
      NoData: 'UIBackgroundFetchResultNoData',
      ResultFailed: 'UIBackgroundFetchResultFailed',
    },
  },
};
