import { renderHook } from '@testing-library/react-native';
import {
  useRenderTime,
  useAutoRenderTime,
  _resetForTesting,
  _simulateBackground,
} from '../useRenderTime';
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
    _resetForTesting();
    // Ensure Math.random always returns a value below 1.0 (default sample rate in __DEV__)
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    jest.spyOn(Date, 'now').mockReturnValue(100);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records render metrics on second render (first establishes baseline)', () => {
    // First render: commit at t=100 (baseline, no metrics)
    // Second render: commit at t=110 → duration = 10ms
    let callIndex = 0;
    const dateValues = [100, 110];
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => dateValues[callIndex++] ?? 110);

    const { rerender } = renderHook(() => useRenderTime('TestComponent'));

    // First render only establishes baseline — no metrics yet
    expect(Telemetry.increment).not.toHaveBeenCalled();

    rerender({});

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
    // Baseline at t=100, second commit at t=200 → duration = 100ms > 10ms threshold
    let callIndex = 0;
    const dateValues = [100, 200];
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => dateValues[callIndex++] ?? 200);

    const { rerender } = renderHook(() =>
      useRenderTime('SlowComponent', { slowThreshold }),
    );

    rerender({});

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'slow_component_renders_total',
      1,
      expect.objectContaining({
        component: 'SlowComponent',
      }),
    );
  });

  it('does not track when enabled is false', () => {
    const { rerender } = renderHook(() =>
      useRenderTime('DisabledComponent', { enabled: false }),
    );
    rerender({});

    expect(Telemetry.increment).not.toHaveBeenCalled();
  });

  it('does not report slow render when duration is below threshold', () => {
    const slowThreshold = 100;
    // Baseline at t=100, second commit at t=105 → duration = 5ms < 100ms threshold
    let callIndex = 0;
    const dateValues = [100, 105];
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => dateValues[callIndex++] ?? 105);

    const { rerender } = renderHook(() =>
      useRenderTime('FastComponent', { slowThreshold }),
    );

    rerender({});

    expect(Telemetry.increment).not.toHaveBeenCalledWith(
      'slow_component_renders_total',
      expect.anything(),
      expect.anything(),
    );
  });

  it('measures consecutive render durations accurately', () => {
    const slowThreshold = 50;
    // Baseline at t=1000, second commit at t=1010 (10ms), third commit at t=1070 (60ms)
    let callIndex = 0;
    const dateValues = [1000, 1010, 1070];
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => dateValues[callIndex++] ?? 1070);

    const { rerender } = renderHook(() =>
      useRenderTime('ConsecutiveComponent', { slowThreshold }),
    );

    // Second render: 10ms (below threshold)
    rerender({});
    expect(Telemetry.increment).not.toHaveBeenCalledWith(
      'slow_component_renders_total',
      expect.anything(),
      expect.anything(),
    );

    (Telemetry.increment as jest.Mock).mockClear();

    // Third render: 60ms (above threshold)
    rerender({});
    expect(Telemetry.increment).toHaveBeenCalledWith(
      'slow_component_renders_total',
      1,
      expect.objectContaining({
        component: 'ConsecutiveComponent',
      }),
    );
  });

  it('discards render when app was backgrounded between commits', () => {
    // Baseline at t=100, background at t=500, second commit at t=600
    // lastBackgroundedAt (500) >= prevCommitTime (100) → discard
    let callIndex = 0;
    const dateValues = [100, 600];
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => dateValues[callIndex++] ?? 600);

    const { rerender } = renderHook(() =>
      useRenderTime('BackgroundedComponent'),
    );

    _simulateBackground(500);
    rerender({});

    expect(Telemetry.histogram).not.toHaveBeenCalled();
    expect(Telemetry.increment).not.toHaveBeenCalled();
  });

  it('discards render exceeding MAX_VALID_RENDER_MS cap', () => {
    // Baseline at t=100, second commit at t=1200 → duration = 1100ms > 1000ms cap
    let callIndex = 0;
    const dateValues = [100, 1200];
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => dateValues[callIndex++] ?? 1200);

    const { rerender } = renderHook(() => useRenderTime('OverCapComponent'));
    rerender({});

    expect(Telemetry.histogram).not.toHaveBeenCalled();
    expect(Telemetry.increment).not.toHaveBeenCalled();
  });

  it('does not discard when background occurred before baseline commit', () => {
    // Background at t=50, baseline at t=100, second commit at t=110
    // lastBackgroundedAt (50) >= prevCommitTime (100) → false → valid
    _simulateBackground(50);

    let callIndex = 0;
    const dateValues = [100, 110];
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => dateValues[callIndex++] ?? 110);

    const { rerender } = renderHook(() => useRenderTime('ValidComponent'));
    rerender({});

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'component_render_count',
      1,
      { component: 'ValidComponent' },
    );
  });
});

describe('useAutoRenderTime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetForTesting();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    jest.spyOn(Date, 'now').mockReturnValue(100);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the provided displayName as the component name', () => {
    let callIndex = 0;
    const dateValues = [100, 110];
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => dateValues[callIndex++] ?? 110);

    const { rerender } = renderHook(() => useAutoRenderTime('MyScreen'));
    rerender({});

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'component_render_count',
      1,
      { component: 'MyScreen' },
    );
  });

  it('falls back to "Component" when no displayName is provided', () => {
    let callIndex = 0;
    const dateValues = [100, 110];
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => dateValues[callIndex++] ?? 110);

    const { rerender } = renderHook(() => useAutoRenderTime());
    rerender({});

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'component_render_count',
      1,
      { component: 'Component' },
    );
  });
});
