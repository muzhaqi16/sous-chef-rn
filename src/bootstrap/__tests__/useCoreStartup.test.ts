import { renderHook } from '@testing-library/react-native';
import { errorService } from '#/services/errorService';
import { mockAppStore } from '#/test-utils/mockAppStore';
import type { StartupHost } from '../startupHost';
import { useCoreStartup } from '../useCoreStartup';

jest.mock('#/services/errorService');
jest.mock('#store/useAppStore', () =>
  mockAppStore({
    isHydrated: true,
    getTelemetryConfig: jest.fn(() => ({})),
  }),
);
jest.mock('#/services/auth/deviceId', () => ({ ensureDeviceId: jest.fn() }));
jest.mock('#/apollo/offlineQueue/queueFailureHandler', () => ({
  registerQueueFailureHandler: jest.fn(),
}));

const { Telemetry } = jest.requireMock<{
  Telemetry: Record<string, jest.Mock>;
}>('#services/telemetry');
const { ensureDeviceId } = jest.requireMock<{ ensureDeviceId: jest.Mock }>(
  '#/services/auth/deviceId',
);
const { registerQueueFailureHandler } = jest.requireMock<{
  registerQueueFailureHandler: jest.Mock;
}>('#/apollo/offlineQueue/queueFailureHandler');

const failing = (step: string) => () => {
  throw new Error(`${step} failed`);
};

/** A host whose every step throws as it is called. */
const brokenHost: StartupHost = {
  beforeStart: failing('beforeStart'),
  afterStart: failing('afterStart'),
  launchProperties: failing('launchProperties'),
  stop: failing('stop'),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useCoreStartup with a failing host', () => {
  it('completes the core start-up', () => {
    renderHook(() => useCoreStartup(brokenHost));

    expect(ensureDeviceId).toHaveBeenCalledTimes(1);
    expect(registerQueueFailureHandler).toHaveBeenCalledTimes(1);
    expect(Telemetry.initialize).toHaveBeenCalledTimes(1);
    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'app_launched',
      expect.objectContaining({ timestamp: expect.any(String) }),
    );
  });

  it('reports each failed step by name', () => {
    const { unmount } = renderHook(() => useCoreStartup(brokenHost));
    unmount();

    const operations = jest
      .mocked(errorService.reportError)
      .mock.calls.map(([, context]) => context?.operation);
    expect(operations).toEqual([
      'startupHost.beforeStart',
      'startupHost.launchProperties',
      'startupHost.afterStart',
      'startupHost.stop',
    ]);
  });

  it('keeps telemetry on when the host asks nothing of it', () => {
    renderHook(() => useCoreStartup(brokenHost));

    expect(Telemetry.updateConfig).toHaveBeenCalledWith({});
  });
});
