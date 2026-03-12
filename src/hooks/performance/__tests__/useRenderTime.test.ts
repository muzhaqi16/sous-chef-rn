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
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure Math.random always returns a value below 1.0 (default sample rate in __DEV__)
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    // Default: Date.now() returns 100 for render, 110 for commit (10ms render)
    jest.spyOn(Date, 'now').mockReturnValue(100);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records render metrics to Telemetry on first render', () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(100) // renderStart
      .mockReturnValue(110); // commitTime in useLayoutEffect

    renderHook(() => useRenderTime('TestComponent'));

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'component_render_count',
      1,
      { component: 'TestComponent' },
    );

    expect(Telemetry.histogram).toHaveBeenCalledWith(
      'component_render_duration_ms',
      10,
      { component: 'TestComponent' },
    );
  });

  it('tracks slow renders when duration exceeds threshold', () => {
    const slowThreshold = 10;
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(100) // renderStart
      .mockReturnValue(200); // commitTime (100ms render > 10ms threshold)

    renderHook(() => useRenderTime('SlowComponent', { slowThreshold }));

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'slow_component_renders_total',
      1,
      expect.objectContaining({
        component: 'SlowComponent',
      }),
    );
  });

  it('does not track when enabled is false', () => {
    renderHook(() => useRenderTime('DisabledComponent', { enabled: false }));

    expect(Telemetry.increment).not.toHaveBeenCalled();
  });

  it('does not report slow render when duration is below threshold', () => {
    const slowThreshold = 100;
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(100) // renderStart
      .mockReturnValue(105); // commitTime (5ms render < 100ms threshold)

    renderHook(() => useRenderTime('FastComponent', { slowThreshold }));

    expect(Telemetry.increment).not.toHaveBeenCalledWith(
      'slow_component_renders_total',
      expect.anything(),
      expect.anything(),
    );
  });

  it('does not report slow render when render is batched', () => {
    const slowThreshold = 100;

    // Use a counter to return different values on each Date.now() call
    let callIndex = 0;
    // First render: renderStart=1000, commitTime=1010 → lastCommitTime=1010
    // Second render: renderStart=500 (< 1010, batched), commitTime=1050
    //   commit gap = 1050 - 1010 = 40ms (< threshold 100)
    const dateValues = [1000, 1010, 500, 1050];
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return dateValues[callIndex++] ?? 1050;
    });

    const { rerender } = renderHook(() =>
      useRenderTime('BatchedComponent', { slowThreshold }),
    );

    (Telemetry.increment as jest.Mock).mockClear();
    rerender({});

    // Should NOT report slow render: commit gap = 40ms < threshold 100ms
    expect(Telemetry.increment).not.toHaveBeenCalledWith(
      'slow_component_renders_total',
      expect.anything(),
      expect.anything(),
    );
  });

  it('reports normal duration for non-batched render after a batched one', () => {
    const slowThreshold = 10;

    let callIndex = 0;
    // First render: renderStart=1000, commitTime=1005 → lastCommitTime=1005
    // Second render (batched): renderStart=500 (< 1005), commitTime=1050 → lastCommitTime=1050
    // Third render (normal): renderStart=2000 (> 1050), commitTime=2060
    //   duration = 2060 - 2000 = 60ms (> threshold 10)
    const dateValues = [1000, 1005, 500, 1050, 2000, 2060];
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return dateValues[callIndex++] ?? 2060;
    });

    const { rerender } = renderHook(() =>
      useRenderTime('RecoveryComponent', { slowThreshold }),
    );

    // Batched render
    rerender({});

    (Telemetry.increment as jest.Mock).mockClear();

    // Normal render after batched
    rerender({});

    // Should report slow render normally (60ms > threshold 10ms)
    expect(Telemetry.increment).toHaveBeenCalledWith(
      'slow_component_renders_total',
      1,
      expect.objectContaining({
        component: 'RecoveryComponent',
      }),
    );
  });
});

describe('useAutoRenderTime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    jest.spyOn(Date, 'now').mockReturnValue(100);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the provided displayName as the component name', () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValue(110);

    renderHook(() => useAutoRenderTime('MyScreen'));

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'component_render_count',
      1,
      { component: 'MyScreen' },
    );
  });

  it('falls back to "Component" when no displayName is provided', () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValue(110);

    renderHook(() => useAutoRenderTime());

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'component_render_count',
      1,
      { component: 'Component' },
    );
  });
});
