'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import {
  useFPSMonitor,
  useSimpleFPS,
} from '#features/devtools/hooks/useFPSMonitor';
import { logger } from '#/utils/environment';

// __DEV__ is true in test env by default
describe('useFPSMonitor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns initial state with defaults', () => {
    const { result } = renderHook(() => useFPSMonitor({ autoStart: false }));

    expect(result.current.fps).toBe(60);
    expect(result.current.isLowFPS).toBe(false);
    expect(result.current.isMonitoring).toBe(false);
    expect(result.current.stats).toEqual({
      current: 60,
      min: 60,
      max: 60,
      avg: 60,
      lowFPSCount: 0,
    });
  });

  it('auto-starts when autoStart is true in DEV', () => {
    const { result } = renderHook(() => useFPSMonitor({ autoStart: true }));
    // autoStart triggers setIsMonitoring(true) via the effect
    // The effect runs but isMonitoring is set inside it
    expect(result.current.fps).toBe(60); // initial value
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[PERF] FPS monitor: started'),
    );
  });

  it('provides startMonitoring and stopMonitoring functions', () => {
    const { result } = renderHook(() => useFPSMonitor({ autoStart: false }));

    expect(typeof result.current.startMonitoring).toBe('function');
    expect(typeof result.current.stopMonitoring).toBe('function');
  });

  it('provides resetStats function that resets to defaults', () => {
    const { result } = renderHook(() => useFPSMonitor({ autoStart: false }));

    act(() => {
      result.current.resetStats();
    });

    expect(result.current.stats).toEqual({
      current: 60,
      min: 60,
      max: 60,
      avg: 60,
      lowFPSCount: 0,
    });
  });

  it('stops monitoring on unmount', () => {
    const cancelAnimationFrameSpy = jest.spyOn(global, 'cancelAnimationFrame');
    const { unmount } = renderHook(() => useFPSMonitor({ autoStart: true }));

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[PERF] FPS monitor: started'),
    );

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    cancelAnimationFrameSpy.mockRestore();
  });

  it('respects custom lowFPSThreshold', () => {
    const { result } = renderHook(() =>
      useFPSMonitor({ autoStart: false, lowFPSThreshold: 50 }),
    );

    // fps is 60 by default, threshold is 50
    expect(result.current.isLowFPS).toBe(false);
  });

  it('startMonitoring does nothing if already monitoring', () => {
    const { result } = renderHook(() => useFPSMonitor({ autoStart: true }));

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[PERF] FPS monitor: started'),
    );

    // Starting while already monitoring should not throw
    act(() => {
      result.current.startMonitoring();
    });

    expect(result.current.fps).toBe(60);
  });

  it('stopMonitoring cleans up all intervals', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const { result } = renderHook(() => useFPSMonitor({ autoStart: true }));

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[PERF] FPS monitor: started'),
    );

    act(() => {
      result.current.stopMonitoring();
    });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[PERF] FPS monitor: stopped'),
    );
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});

describe('useSimpleFPS', () => {
  it('returns initial fps of 60', () => {
    const { result } = renderHook(() => useSimpleFPS());
    expect(result.current).toBe(60);
  });
});
