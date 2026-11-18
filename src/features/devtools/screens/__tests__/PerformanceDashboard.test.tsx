import React from 'react';
import DeviceInfo from 'react-native-device-info';
import performance from 'react-native-performance';
import type {
  EntryType,
  PerformanceReactNativeMark,
} from 'react-native-performance';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useStore } from '#store';
import { alertService } from '#/services/alertService';
import { MemoryMonitor } from '#/services/performance/MemoryMonitor';
import { usePerformanceStore } from '#/services/performance/performanceStore';
import type {
  MemorySnapshot,
  RenderMetrics,
  ScreenMetrics,
} from '#/services/performance/types';
import { Environment } from '#/utils/environment';
import { SubScreen } from '#components/templates/SubScreen';
import { useFPSMonitor } from '#features/devtools/hooks/useFPSMonitor';
import { withDeadline } from '#/test-utils/cacheWaits';
import { PerformanceDashboard } from '../PerformanceDashboard';

// Jest draws no frames, so the meter's readings are stated.
jest.mock('#features/devtools/hooks/useFPSMonitor');

const MB = 1024 * 1024;

const component = (componentName: string, ms: number): RenderMetrics => ({
  componentName,
  renderCount: 1,
  lastRenderTime: ms,
  avgRenderTime: ms,
  maxRenderTime: ms,
  totalRenderTime: ms,
  lastRenderTimestamp: 0,
});

const screenMetric = (screenName: string, ms: number): ScreenMetrics => ({
  screenName,
  transitionCount: 1,
  lastInteractiveTime: ms,
  avgInteractiveTime: ms,
  maxInteractiveTime: ms,
  totalInteractiveTime: ms,
  lastTransitionTimestamp: 0,
});

const reading = (usagePercent: number, timestamp: number): MemorySnapshot => ({
  timestamp,
  usedBytes: usagePercent * MB,
  limitBytes: 100 * MB,
  usagePercent,
});

/** The tracking settings and collected metrics, written to the real store. */
function held({
  components = [],
  screens = [],
  readings = [],
  ...tracking
}: {
  isEnabled?: boolean;
  trackRenders?: boolean;
  trackMemory?: boolean;
  trackScreens?: boolean;
  components?: RenderMetrics[];
  screens?: ScreenMetrics[];
  readings?: MemorySnapshot[];
}) {
  usePerformanceStore.setState({
    ...tracking,
    componentMetrics: new Map(components.map(m => [m.componentName, m])),
    screenMetrics: new Map(screens.map(m => [m.screenName, m])),
    memorySnapshots: readings,
  });
}

/** Who is looking: a debug build, and whether the account may use dev tools. */
function viewer({
  debugBuild,
  devTools,
}: {
  debugBuild: boolean;
  devTools: boolean;
}) {
  jest
    .mocked(Environment.shouldEnableDebugFeatures)
    .mockReturnValue(debugBuild);
  useStore.setState({
    user: {
      id: 'me',
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
      canAccessDevTools: devTools,
    },
  });
}

const entry = (
  name: string,
  entryType: EntryType,
  startTime: number,
  duration = 0,
): PerformanceReactNativeMark => ({
  name,
  entryType,
  startTime,
  duration,
  detail: undefined,
  toJSON: () => ({ name, entryType, startTime, duration, detail: undefined }),
});

/** What the native performance API holds, by entry type. */
function recorded(
  byType: Partial<Record<EntryType, PerformanceReactNativeMark[]>>,
) {
  jest
    .mocked(performance.getEntriesByType)
    .mockImplementation(type => byType[type] ?? []);
}

/** The device's memory as the native module reads it. */
function deviceMemory(usedBytes: number, totalBytes: number) {
  Object.assign(DeviceInfo, {
    getUsedMemory: jest.fn().mockResolvedValue(usedBytes),
    getTotalMemory: jest.fn().mockResolvedValue(totalBytes),
  });
}

/** Resolves once the store holds a memory reading taken for `context`. */
const readingLands = (context: string) =>
  act(() =>
    withDeadline(
      done => {
        const has = () =>
          usePerformanceStore
            .getState()
            .memorySnapshots.some(snapshot => snapshot.context === context);
        if (has()) done();
        return usePerformanceStore.subscribe(() => {
          if (has()) done();
        });
      },
      () =>
        `no "${context}" reading; the store holds ${JSON.stringify(
          usePerformanceStore.getState().memorySnapshots,
        )}`,
    ),
  );

const switchNamed = (name: string) => screen.getByRole('switch', { name });

const toggle = (name: string, value: boolean) =>
  fireEvent(switchNamed(name), 'valueChange', value);

/** Presses a button of the last alert raised; a cancel has no handler. */
async function answerAlert(text: string) {
  const [, , buttons] = jest.mocked(alertService.alert).mock.lastCall ?? [];
  const button = buttons?.find(candidate => candidate.text === text);
  if (!button) throw new Error(`no "${text}" in the last alert`);
  await act(async () => {
    button.onPress?.();
  });
}

const pullToRefresh = () =>
  act(async () => {
    screen.UNSAFE_getByType(SubScreen).props.refresh?.onRefresh();
  });

const EMPTY = 'No performance data collected yet.';
const CLEAR = 'Clear Performance Data';

beforeEach(() => {
  jest.clearAllMocks();
  usePerformanceStore.setState(usePerformanceStore.getInitialState(), true);
  held({
    isEnabled: true,
    trackRenders: true,
    trackMemory: false,
    trackScreens: true,
  });
  viewer({ debugBuild: true, devTools: false });
  recorded({});
  deviceMemory(512 * MB, 1024 * MB);
  jest.mocked(useFPSMonitor).mockReturnValue({
    fps: 58,
    isLowFPS: false,
    stats: { current: 58, min: 42, max: 60, avg: 55, lowFPSCount: 3 },
  });
});

afterEach(() => {
  MemoryMonitor.stop();
  jest.restoreAllMocks();
});

describe('who may open it', () => {
  it.each([
    { who: 'a debug build', debugBuild: true, devTools: false, opens: true },
    {
      who: 'an admin in a release build',
      debugBuild: false,
      devTools: true,
      opens: true,
    },
    {
      who: 'anyone else in a release build',
      debugBuild: false,
      devTools: false,
      opens: false,
    },
  ])('$who: opens $opens', ({ debugBuild, devTools, opens }) => {
    viewer({ debugBuild, devTools });
    render(<PerformanceDashboard />);

    expect(screen.queryByText('Performance Tracking') !== null).toBe(opens);
    expect(
      screen.queryByText(
        'Performance dashboard is only available to administrators.',
      ) !== null,
    ).toBe(!opens);
  });
});

describe('the tracking switches', () => {
  it('turn the other three off while tracking is off', () => {
    held({ isEnabled: false });
    render(<PerformanceDashboard />);

    for (const name of [
      'Track Component Renders',
      'Track Memory Usage',
      'Track Screen Transitions',
    ]) {
      expect(switchNamed(name)).toBeDisabled();
    }
    expect(switchNamed('Enable Performance Tracking')).toBeEnabled();
  });

  it.each([
    { name: 'Enable Performance Tracking', field: 'isEnabled' },
    { name: 'Track Component Renders', field: 'trackRenders' },
    { name: 'Track Screen Transitions', field: 'trackScreens' },
  ] as const)('$name saves $field alone', ({ name, field }) => {
    held({ trackRenders: false, trackMemory: false, trackScreens: false });
    render(<PerformanceDashboard />);
    const before = usePerformanceStore.getState();

    toggle(name, field === 'isEnabled' ? false : true);

    const after = usePerformanceStore.getState();
    for (const key of [
      'isEnabled',
      'trackRenders',
      'trackMemory',
      'trackScreens',
    ] as const) {
      expect(after[key]).toBe(key === field ? !before[key] : before[key]);
    }
  });

  it('start memory sampling every ten seconds, with a first reading', async () => {
    const start = jest.spyOn(MemoryMonitor, 'start');
    render(<PerformanceDashboard />);

    toggle('Track Memory Usage', true);
    await readingLands('monitor_start');

    expect(start).toHaveBeenCalledWith(10000);
    expect(MemoryMonitor.isEnabled()).toBe(true);
    expect(screen.getByText('Memory Usage')).toBeTruthy();
    expect(screen.getAllByText('50.0%').length).toBeGreaterThan(0);
  });

  it('stop memory sampling when memory tracking goes off', async () => {
    render(<PerformanceDashboard />);
    toggle('Track Memory Usage', true);
    await readingLands('monitor_start');

    toggle('Track Memory Usage', false);

    expect(MemoryMonitor.isEnabled()).toBe(false);
  });

  it('stop memory sampling when tracking goes off', async () => {
    render(<PerformanceDashboard />);
    toggle('Track Memory Usage', true);
    await readingLands('monitor_start');

    toggle('Enable Performance Tracking', false);

    expect(MemoryMonitor.isEnabled()).toBe(false);
  });
});

describe('what it shows', () => {
  it('says nothing is collected yet, with nothing to clear', () => {
    render(<PerformanceDashboard />);

    expect(screen.getByText(EMPTY)).toBeTruthy();
    expect(screen.queryByText(CLEAR)).toBeNull();
  });

  it('says nothing while tracking is off', () => {
    held({ isEnabled: false });
    render(<PerformanceDashboard />);

    expect(screen.queryByText(EMPTY)).toBeNull();
  });

  it('counts memory readings alone as data', () => {
    held({ trackMemory: true, readings: [reading(40, 1)] });
    render(<PerformanceDashboard />);

    expect(screen.queryByText(EMPTY)).toBeNull();
    expect(screen.getByText(CLEAR)).toBeTruthy();
  });

  it.each([
    { off: 'trackRenders', card: 'Slowest Components' },
    { off: 'trackScreens', card: 'Slowest Screen Transitions' },
    { off: 'trackMemory', card: 'Memory Usage' },
  ] as const)('hides "$card" while $off is off', ({ off, card }) => {
    held({
      trackRenders: true,
      trackMemory: true,
      trackScreens: true,
      [off]: false,
      components: [component('Row', 4)],
      screens: [screenMetric('Pantry', 120)],
      readings: [reading(40, 1)],
    });
    render(<PerformanceDashboard />);

    expect(screen.queryByText(card)).toBeNull();
  });

  it('lists the ten slowest components, slowest first', () => {
    held({
      components: Array.from({ length: 11 }, (_, index) =>
        component(`Component ${index + 1}`, index + 1),
      ),
    });
    render(<PerformanceDashboard />);

    const names = screen
      .getAllByText(/^Component \d+$/)
      .map(row => row.props.children);
    expect(names).toEqual(
      Array.from({ length: 10 }, (_, index) => `Component ${11 - index}`),
    );
  });

  it('lists screens slowest first', () => {
    held({ screens: [screenMetric('Fast', 50), screenMetric('Slow', 900)] });
    render(<PerformanceDashboard />);

    const names = screen
      .getAllByText(/^(Fast|Slow)$/)
      .map(row => row.props.children);
    expect(names).toEqual(['Slow', 'Fast']);
  });

  it('reads memory from the last five readings, the newest as current', () => {
    held({
      trackMemory: true,
      readings: [10, 20, 30, 40, 50, 60, 70].map((percent, index) =>
        reading(percent, index),
      ),
    });
    render(<PerformanceDashboard />);

    expect(screen.getAllByText('70.0%').length).toBeGreaterThan(0);
    expect(screen.queryByText('20.0%')).toBeNull();
  });

  it('shows the live frame rate in a debug build', () => {
    render(<PerformanceDashboard />);

    expect(screen.getByText('58')).toBeTruthy();
    expect(screen.getByText('42 / 55 / 60')).toBeTruthy();
  });

  it('times the launch and the bundle load from their marks', () => {
    recorded({
      'react-native-mark': [
        entry('nativeLaunchStart', 'react-native-mark', 0),
        entry('nativeLaunchEnd', 'react-native-mark', 250),
        entry('runJsBundleStart', 'react-native-mark', 300),
        entry('runJsBundleEnd', 'react-native-mark', 420),
      ],
    });
    render(<PerformanceDashboard />);

    expect(screen.getByText('250.00ms')).toBeTruthy();
    expect(screen.getByText('120.00ms')).toBeTruthy();
  });

  it('lists recent requests newest first', () => {
    recorded({
      resource: [
        entry('https://first.example/a', 'resource', 1, 30),
        entry('https://second.example/b', 'resource', 2, 40),
      ],
    });
    render(<PerformanceDashboard />);

    const hosts = screen
      .getAllByText(/\.example$/)
      .map(row => row.props.children);
    expect(hosts).toEqual(['second.example', 'first.example']);
  });

  it('says when it last updated', () => {
    render(<PerformanceDashboard />);

    expect(screen.getByText(/^Last updated: \S/)).toBeTruthy();
  });
});

describe('clearing', () => {
  it('asks first, and cancelling keeps the metrics', async () => {
    held({ components: [component('Row', 4)] });
    render(<PerformanceDashboard />);

    fireEvent.press(screen.getByText(CLEAR));
    expect(alertService.alert).toHaveBeenLastCalledWith(
      CLEAR,
      'Are you sure you want to clear all performance metrics?',
      expect.any(Array),
    );
    await answerAlert('Cancel');

    expect(screen.getByText('Row')).toBeTruthy();
    expect(usePerformanceStore.getState().componentMetrics.size).toBe(1);
  });

  it('empties the metrics and the recorded marks once confirmed', async () => {
    held({ components: [component('Row', 4)] });
    render(<PerformanceDashboard />);

    fireEvent.press(screen.getByText(CLEAR));
    await answerAlert('Clear');

    expect(screen.queryByText('Row')).toBeNull();
    expect(screen.getByText(EMPTY)).toBeTruthy();
    expect(performance.clearMarks).toHaveBeenCalled();
  });
});

describe('pulling to refresh', () => {
  it('takes a memory reading while memory is tracked', async () => {
    held({ trackMemory: true });
    const takeSnapshot = jest.spyOn(MemoryMonitor, 'takeSnapshot');
    render(<PerformanceDashboard />);

    await pullToRefresh();
    await readingLands('manual_refresh');

    expect(takeSnapshot).toHaveBeenCalledWith('manual_refresh');
    expect(screen.getAllByText('50.0%').length).toBeGreaterThan(0);
  });

  it('takes none while tracking is off', async () => {
    held({ isEnabled: false, trackMemory: true });
    const takeSnapshot = jest.spyOn(MemoryMonitor, 'takeSnapshot');
    render(<PerformanceDashboard />);

    await pullToRefresh();

    expect(takeSnapshot).not.toHaveBeenCalled();
  });
});
