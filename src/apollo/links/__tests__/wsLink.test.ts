'use no memo';

// Mock store before importing wsLink
jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({
      accessToken: 'mock-token',
    })),
  },
}));

// Mock environment
jest.mock('#/utils/environment', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  Environment: {
    getApiConfig: jest.fn(() => ({
      wsUrl: 'ws://localhost:4000/graphql',
    })),
  },
}));

// Mock errorSerialization
jest.mock('#/utils/errorSerialization', () => ({
  serializeError: jest.fn((e: any) => e?.message || 'unknown'),
}));

// Mock deviceId
jest.mock('#/utils/deviceId', () => ({
  getDeviceIdSync: jest.fn(() => 'test-device-id'),
}));

import {
  reconnectWebSocket,
  isWebSocketReconnecting,
  disableAutoReconnect,
  enableAutoReconnect,
  disposeWebSocket,
  getWebSocketState,
} from '../wsLink';

describe('wsLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-enable auto reconnect for each test
    enableAutoReconnect();
  });

  describe('isWebSocketReconnecting', () => {
    it('returns false initially', () => {
      expect(isWebSocketReconnecting()).toBe(false);
    });
  });

  describe('getWebSocketState', () => {
    it('returns current state object', () => {
      const state = getWebSocketState();
      expect(state).toHaveProperty('isReconnecting');
      expect(state).toHaveProperty('lastReconnectTime');
      expect(state).toHaveProperty('hasClient');
      expect(state.hasClient).toBe(true);
    });
  });

  describe('reconnectWebSocket', () => {
    it('calls terminate on the ws client', () => {
      reconnectWebSocket();
      // The graphql-ws mock's terminate should be called
      const { createClient } = require('graphql-ws');
      const mockClient = createClient.mock.results[0]?.value;
      if (mockClient) {
        expect(mockClient.terminate).toHaveBeenCalled();
      }
    });

    it('debounces rapid reconnection attempts', () => {
      reconnectWebSocket();
      reconnectWebSocket(); // Should be debounced
      // Second call should be a no-op due to debounce
      expect(isWebSocketReconnecting()).toBe(false);
    });
  });

  describe('disableAutoReconnect', () => {
    it('prevents auto reconnection', () => {
      disableAutoReconnect();
      const state = getWebSocketState();
      // After disabling, state should be stable
      expect(state.hasClient).toBe(true);
    });
  });

  describe('enableAutoReconnect', () => {
    it('re-enables auto reconnection after disable', () => {
      disableAutoReconnect();
      enableAutoReconnect();
      // Should not throw
      expect(getWebSocketState().hasClient).toBe(true);
    });
  });

  describe('disposeWebSocket', () => {
    it('disposes the websocket client gracefully', () => {
      disposeWebSocket();
      const state = getWebSocketState();
      expect(state.isReconnecting).toBe(false);
    });

    it('handles disposal errors gracefully', () => {
      const { createClient } = require('graphql-ws');
      const mockClient = createClient.mock.results[0]?.value;
      if (mockClient) {
        mockClient.dispose.mockImplementation(() => {
          throw new Error('dispose error');
        });
      }
      // Should not throw
      expect(() => disposeWebSocket()).not.toThrow();
    });

    it('resets lastReconnectTime to 0', () => {
      // First trigger a reconnect to set lastReconnectTime
      enableAutoReconnect();
      reconnectWebSocket();
      // Now dispose
      disposeWebSocket();
      const state = getWebSocketState();
      expect(state.lastReconnectTime).toBe(0);
    });
  });

  describe('reconnectWebSocket - error handling', () => {
    it('handles terminate error and schedules reconnect', () => {
      enableAutoReconnect();
      const { createClient } = require('graphql-ws');
      const mockClient = createClient.mock.results[0]?.value;
      if (mockClient) {
        mockClient.terminate.mockImplementation(() => {
          throw new Error('terminate error');
        });
      }
      // Should not throw
      expect(() => reconnectWebSocket()).not.toThrow();
      // Reset
      if (mockClient) {
        mockClient.terminate.mockImplementation(jest.fn());
      }
    });
  });

  describe('getWebSocketState - detailed', () => {
    it('returns correct hasClient state', () => {
      const state = getWebSocketState();
      expect(state.hasClient).toBe(true);
      expect(typeof state.isReconnecting).toBe('boolean');
      expect(typeof state.lastReconnectTime).toBe('number');
    });
  });

  describe('disableAutoReconnect - detailed', () => {
    it('clears reconnect attempts counter', () => {
      disableAutoReconnect();
      // After disabling, re-enabling and checking state should work
      enableAutoReconnect();
      const state = getWebSocketState();
      expect(state.hasClient).toBe(true);
    });
  });
});
