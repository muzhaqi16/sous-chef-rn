'use no memo';
jest.mock('react-native-performance', () => {
  const entries = [];
  const performance = {
    timeOrigin: 0,
    now: jest.fn(() => Date.now()),
    mark: jest.fn(name => {
      const entry = {
        name,
        entryType: 'mark',
        startTime: Date.now(),
        duration: 0,
      };
      entries.push(entry);
      return entry;
    }),
    measure: jest.fn(name => {
      const entry = {
        name,
        entryType: 'measure',
        startTime: Date.now(),
        duration: 0,
      };
      entries.push(entry);
      return entry;
    }),
    metric: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    clearMetrics: jest.fn(),
    clearResourceTimings: jest.fn(),
    getEntries: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  };

  return {
    __esModule: true,
    default: performance,
    PerformanceObserver: jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: jest.fn(() => []),
    })),
    setResourceLoggingEnabled: jest.fn(),
  };
});
