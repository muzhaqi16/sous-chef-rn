import { renderHook } from '@testing-library/react-native';
import { useRenderTime, useAutoRenderTime } from '../useRenderTime';
import { Telemetry } from '#/services/telemetry';

const mockMeasure = jest.fn();
const mockNow = jest.fn();
const mockClearMeasures = jest.fn();

jest.mock('react-native-performance', () => ({
  __esModule: true,
  default: {
    now: (...args: any[]) => mockNow(...args),
    measure: (...args: any[]) => mockMeasure(...args),
    clearMeasures: (...args: any[]) => mockClearMeasures(...args),
  },
}));

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
    // Default: render-phase now() returns 100, measure returns 10ms duration
    mockNow.mockReturnValue(100);
    mockMeasure.mockReturnValue({ duration: 10 });
  });

  it('calls performance.measure with correct name and start option in layout effect', () => {
    mockNow.mockReturnValue(42);
    mockMeasure.mockReturnValue({ duration: 8 });

    renderHook(() => useRenderTime('TestComponent'));

    expect(mockMeasure).toHaveBeenCalledWith(
      'component:TestComponent:render',
      { start: 42 },
    );
  });

  it('records render metrics to Telemetry on first render', () => {
    mockMeasure.mockReturnValue({ duration: 10 });

    renderHook(() => useRenderTime('TestComponent'));

    // Histogram is now routed by NativePerformanceService observer, not called directly
    expect(Telemetry.histogram).not.toHaveBeenCalled();

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'component_render_count',
      1,
      { component: 'TestComponent' },
    );
  });

  it('tracks slow renders when duration exceeds threshold', () => {
    const slowThreshold = 10;
    mockMeasure.mockReturnValue({ duration: 50 });

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
    mockMeasure.mockReturnValue({ duration: 5 });

    renderHook(() => useRenderTime('FastComponent', { slowThreshold }));

    expect(Telemetry.increment).not.toHaveBeenCalledWith(
      'slow_component_renders_total',
      expect.anything(),
      expect.anything(),
    );
  });

  it('cleans up measures via performance.clearMeasures', () => {
    renderHook(() => useRenderTime('TestComponent'));

    expect(mockClearMeasures).toHaveBeenCalledWith(
      'component:TestComponent:render',
    );
  });
});

describe('useAutoRenderTime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    mockNow.mockReturnValue(100);
    mockMeasure.mockReturnValue({ duration: 5 });
  });

  it('uses the provided displayName as the component name', () => {
    renderHook(() => useAutoRenderTime('MyScreen'));

    expect(mockMeasure).toHaveBeenCalledWith(
      'component:MyScreen:render',
      { start: 100 },
    );

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'component_render_count',
      1,
      { component: 'MyScreen' },
    );
  });

  it('falls back to "Component" when no displayName is provided', () => {
    renderHook(() => useAutoRenderTime());

    expect(mockMeasure).toHaveBeenCalledWith(
      'component:Component:render',
      { start: 100 },
    );

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'component_render_count',
      1,
      { component: 'Component' },
    );
  });
});
