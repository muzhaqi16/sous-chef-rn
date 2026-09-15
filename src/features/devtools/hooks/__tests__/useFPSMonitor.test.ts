'use no memo';

import { renderHook } from '@testing-library/react-native';
import { useFPSMonitor } from '#features/devtools/hooks/useFPSMonitor';
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
    expect(result.current.stats).toEqual({
      current: 60,
      min: 60,
      max: 60,
      avg: 60,
      lowFPSCount: 0,
    });
  });

  it('does not start when autoStart is false', () => {
    renderHook(() => useFPSMonitor({ autoStart: false }));

    expect(logger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('[PERF] FPS monitor: started'),
    );
  });

  it('auto-starts when autoStart is true in DEV', () => {
    const { result } = renderHook(() => useFPSMonitor({ autoStart: true }));

    expect(result.current.fps).toBe(60);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[PERF] FPS monitor: started'),
    );
  });

  it('stops the frame loop and intervals on unmount', () => {
    const cancelAnimationFrameSpy = jest.spyOn(global, 'cancelAnimationFrame');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const { unmount } = renderHook(() => useFPSMonitor({ autoStart: true }));

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    cancelAnimationFrameSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('respects custom lowFPSThreshold', () => {
    const { result } = renderHook(() =>
      useFPSMonitor({ autoStart: false, lowFPSThreshold: 70 }),
    );

    expect(result.current.isLowFPS).toBe(true);
  });
});
