import { renderHook } from '@testing-library/react-native';
import {
  useCommitTracking,
  _resetForTesting,
  _simulateBackground,
} from '../useCommitTracking';
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

describe('useCommitTracking', () => {
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

    const { rerender } = renderHook(() => useCommitTracking('TestComponent'));

    // First render only establishes baseline — no metrics yet
    expect(Telemetry.increment).not.toHaveBeenCalled();

    rerender({});

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'component_render_count',
      1,
      { component: 'TestComponent' },
    );

    expect(Telemetry.histogram).toHaveBeenCalledWith(
      'component_commit_gap_ms',
      10,
      { component: 'TestComponent' },
    );
  });

  it('reports in production builds, not only in __DEV__', () => {
    // The production slowRenderThreshold of 16ms is meaningless if the hook is
    // inert there; a __DEV__ guard on the reporting effect once made it so.
    const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    try {
      let callIndex = 0;
      const dateValues = [100, 200];
      jest
        .spyOn(Date, 'now')
        .mockImplementation(() => dateValues[callIndex++] ?? 200);

      const { rerender } = renderHook(() => useCommitTracking('ProdComponent'));
      rerender({});

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'component_commit_gap_ms',
        100,
        { component: 'ProdComponent' },
      );
      expect(Telemetry.increment).toHaveBeenCalledWith(
        'component_render_count',
        1,
        { component: 'ProdComponent' },
      );
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
    }
  });

  it('does not track when enabled is false', () => {
    const { rerender } = renderHook(() =>
      useCommitTracking('DisabledComponent', { enabled: false }),
    );
    rerender({});

    expect(Telemetry.increment).not.toHaveBeenCalled();
  });

  it('measures consecutive commit gaps accurately', () => {
    // Baseline at t=1000, second commit at t=1010 (10ms gap), third at t=1070 (60ms gap)
    let callIndex = 0;
    const dateValues = [1000, 1010, 1070];
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => dateValues[callIndex++] ?? 1070);

    const { rerender } = renderHook(() =>
      useCommitTracking('ConsecutiveComponent'),
    );

    rerender({});
    expect(Telemetry.histogram).toHaveBeenCalledWith(
      'component_commit_gap_ms',
      10,
      { component: 'ConsecutiveComponent' },
    );

    rerender({});
    expect(Telemetry.histogram).toHaveBeenCalledWith(
      'component_commit_gap_ms',
      60,
      { component: 'ConsecutiveComponent' },
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
      useCommitTracking('BackgroundedComponent'),
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

    const { rerender } = renderHook(() =>
      useCommitTracking('OverCapComponent'),
    );
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

    const { rerender } = renderHook(() => useCommitTracking('ValidComponent'));
    rerender({});

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'component_render_count',
      1,
      { component: 'ValidComponent' },
    );
  });
});
