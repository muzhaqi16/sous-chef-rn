'use no memo';

// Mock tokenScheduler and refreshToken to break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackEvent: jest.fn(),
    increment: jest.fn(),
  },
}));

jest.mock('#/services/performance/types', () => ({
  DEFAULT_PERFORMANCE_CONFIG: {
    enabled: true,
    trackRenders: true,
    trackMemory: false,
    trackScreens: true,
    sampleRate: 1.0,
    slowRenderThreshold: 500,
    memoryWarningThreshold: 80,
    maxMemorySnapshots: 100,
  },
}));

const mockRecordScreenTransition = jest.fn();
jest.mock('#/store/performanceStore', () => ({
  usePerformanceStore: {
    getState: jest.fn(() => ({
      recordScreenTransition: mockRecordScreenTransition,
    })),
  },
}));

import { renderHook } from '@testing-library/react-native';
import { useScreenTransition } from '../useScreenTransition';
import performance from 'react-native-performance';
import { Telemetry } from '#/services/telemetry';
import { useFocusEffect } from '@react-navigation/native';

describe('useScreenTransition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a focus mark when enabled', () => {
    renderHook(() => useScreenTransition('HomeScreen'));

    expect(performance.mark).toHaveBeenCalledWith('screen:HomeScreen:focus');
  });

  it('creates a mounted mark when enabled', () => {
    renderHook(() => useScreenTransition('HomeScreen'));

    expect(performance.mark).toHaveBeenCalledWith('screen:HomeScreen:mounted');
  });

  it('measures focus to mount time', () => {
    renderHook(() => useScreenTransition('HomeScreen'));

    expect(performance.measure).toHaveBeenCalledWith(
      'screen:HomeScreen:mount',
      'screen:HomeScreen:focus',
      'screen:HomeScreen:mounted',
    );
  });

  it('does not create marks when enabled is false', () => {
    renderHook(() => useScreenTransition('HomeScreen', { enabled: false }));

    expect(performance.mark).not.toHaveBeenCalled();
  });

  it('does not create mount mark when trackMount is false', () => {
    renderHook(() => useScreenTransition('HomeScreen', { trackMount: false }));

    // Focus mark should still be created
    expect(performance.mark).toHaveBeenCalledWith('screen:HomeScreen:focus');
    // But mount mark should not
    expect(performance.mark).not.toHaveBeenCalledWith(
      'screen:HomeScreen:mounted',
    );
  });

  it('cleans up marks on blur callback', () => {
    // The useFocusEffect mock calls the callback and returns its cleanup
    const mockUseFocusEffect = useFocusEffect as jest.Mock;

    // Reset to capture the cleanup
    let cleanupFn: (() => void) | undefined;
    mockUseFocusEffect.mockImplementation((cb: () => (() => void) | void) => {
      cleanupFn = cb() as (() => void) | undefined;
    });

    renderHook(() => useScreenTransition('HomeScreen'));

    // Execute cleanup
    if (cleanupFn) {
      cleanupFn();
    }

    expect(performance.clearMarks).toHaveBeenCalledWith(
      'screen:HomeScreen:focus',
    );
    expect(performance.clearMarks).toHaveBeenCalledWith(
      'screen:HomeScreen:mounted',
    );
    expect(performance.clearMarks).toHaveBeenCalledWith(
      'screen:HomeScreen:interactiveEnd',
    );

    // Restore original mock
    mockUseFocusEffect.mockImplementation((cb: Function) => cb());
  });

  it('reports a slow transition without putting duration in a label', () => {
    // duration as a label mints a new time series per distinct millisecond.
    jest.useFakeTimers();
    (performance.measure as jest.Mock).mockReturnValue({ duration: 600 });

    try {
      renderHook(() => useScreenTransition('SlowScreen'));
      jest.runAllTimers();

      const call = (Telemetry.increment as jest.Mock).mock.calls.find(
        c => c[0] === 'slow_screen_transitions_total',
      );
      expect(call).toBeDefined();
      expect(call![2]).toEqual({ screen: 'SlowScreen' });
    } finally {
      jest.useRealTimers();
      (performance.measure as jest.Mock).mockReset();
    }
  });

  it('handles different screen names', () => {
    renderHook(() => useScreenTransition('SettingsScreen'));

    expect(performance.mark).toHaveBeenCalledWith(
      'screen:SettingsScreen:focus',
    );
  });
});
