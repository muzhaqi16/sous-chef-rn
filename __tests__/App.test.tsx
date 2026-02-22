/**
 * Minimal App smoke test.
 *
 * The App component has deep native-module dependencies that make full rendering
 * impractical in a Jest environment. Real integration testing is covered by the
 * Detox E2E suite. This test verifies the module is importable.
 *
 * We mock App.tsx's direct imports that transitively load native modules so the
 * require() below resolves without hitting TurboModule/NativeModule bindings.
 */

// Navigation tree → all screens → dozens of native modules
jest.mock('../src/navigation/RootNavigator', () => ({ Navigation: () => null }));

// Hooks / services that pull in native SDKs
jest.mock('../src/hooks/useNetworkStatus', () => ({ useNetworkStatus: jest.fn() }));
jest.mock('../src/services/performance/MemoryMonitor', () => ({
  MemoryMonitor: { start: jest.fn(), stop: jest.fn() },
}));
jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
  enableFreeze: jest.fn(),
}));

// Apollo client creates WebSocket links / polling timers that keep Jest alive
jest.mock('../src/apollo/client', () => ({
  client: {
    watchQuery: jest.fn(),
    query: jest.fn(),
    mutate: jest.fn(),
    subscribe: jest.fn(),
    readQuery: jest.fn(),
    writeQuery: jest.fn(),
    cache: { reset: jest.fn() },
  },
}));
jest.mock('../src/apollo/offlineQueue/queueManager', () => ({
  queueManager: { onOnline: jest.fn(), onOffline: jest.fn(), processQueue: jest.fn() },
}));

describe('App module', () => {
  it('exports a default component', () => {
    const mod = require('../App');
    expect(mod).toBeDefined();
    expect(typeof mod.default === 'function' || typeof mod === 'function').toBe(true);
  });
});
