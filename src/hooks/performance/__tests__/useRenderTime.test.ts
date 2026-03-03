import { renderHook } from '@testing-library/react-native';
import { useRenderTime, useAutoRenderTime } from '../useRenderTime';
import { Telemetry } from '#/services/telemetry';

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    histogram: jest.fn(),
    increment: jest.fn(),
  },
}));

jest.mock('#/store/performanceStore', () => ({
  usePerformanceStore: {
    getState: jest.fn(() => ({
      recordComponentRender: jest.fn(),
    })),
  },
}));

describe('useRenderTime', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure Math.random always returns a value below 1.0 (default sample rate in __DEV__)
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  it('records render metrics to Telemetry on first render', () => {
    // Use a sequence: render reads start time (100), effect reads end time (110)
    let callCount = 0;
    nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => {
      callCount += 1;
      // Odd calls are render-phase (start), even calls are effect-phase (end)
      return callCount % 2 === 1 ? 100 : 110;
    });

    renderHook(() => useRenderTime('TestComponent'));

    expect(Telemetry.histogram).toHaveBeenCalledWith(
      'component_render_duration_ms',
      expect.any(Number),
      { component: 'TestComponent' },
    );

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'component_render_count',
      1,
      { component: 'TestComponent' },
    );
  });

  it('tracks slow renders when duration exceeds threshold', () => {
    const slowThreshold = 10;

    // Use increasing timestamps: render reads start, effect reads end
    // renderHook may cause multiple render calls, so use an increasing sequence
    // where the end time is always significantly ahead of the start time
    let tick = 0;
    nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => {
      tick += 1;
      // First call (render) = 0, second call (effect) = 50
      // If there are additional render cycles they'll get 100, 150, etc.
      return tick * 50 - 50;
    });

    renderHook(() =>
      useRenderTime('SlowComponent', { slowThreshold }),
    );

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'slow_component_renders_total',
      1,
      expect.objectContaining({
        component: 'SlowComponent',
      }),
    );
  });

  it('does not track when enabled is false', () => {
    nowSpy = jest.spyOn(performance, 'now').mockReturnValue(100);

    renderHook(() =>
      useRenderTime('DisabledComponent', { enabled: false }),
    );

    expect(Telemetry.histogram).not.toHaveBeenCalled();
    expect(Telemetry.increment).not.toHaveBeenCalled();
  });

  it('does not report slow render when duration is below threshold', () => {
    const slowThreshold = 100;

    // Duration = 5ms, well below 100ms threshold
    let callCount = 0;
    nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => {
      callCount += 1;
      return callCount % 2 === 1 ? 0 : 5;
    });

    renderHook(() =>
      useRenderTime('FastComponent', { slowThreshold }),
    );

    expect(Telemetry.increment).not.toHaveBeenCalledWith(
      'slow_component_renders_total',
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('useAutoRenderTime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  it('uses the provided displayName as the component name', () => {
    let callCount = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      callCount += 1;
      return callCount % 2 === 1 ? 0 : 5;
    });

    renderHook(() => useAutoRenderTime('MyScreen'));

    expect(Telemetry.histogram).toHaveBeenCalledWith(
      'component_render_duration_ms',
      expect.any(Number),
      { component: 'MyScreen' },
    );
  });

  it('falls back to "Component" when no displayName is provided', () => {
    let callCount = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      callCount += 1;
      return callCount % 2 === 1 ? 0 : 5;
    });

    renderHook(() => useAutoRenderTime());

    expect(Telemetry.histogram).toHaveBeenCalledWith(
      'component_render_duration_ms',
      expect.any(Number),
      { component: 'Component' },
    );
  });
});
