import performance, {
  PerformanceObserver,
  setResourceLoggingEnabled,
} from 'react-native-performance';
import { Telemetry } from '#/services/telemetry';
import { NativePerformanceService } from '../NativePerformanceService';

interface MockObserver {
  observe: jest.Mock;
  disconnect: jest.Mock;
  _callback: (list: {
    getEntries: () => Array<Record<string, unknown>>;
  }) => void;
}

const observers: MockObserver[] = [];

jest.mock('react-native-performance', () => {
  return {
    __esModule: true,
    default: {
      mark: jest.fn(),
      measure: jest.fn(),
    },
    PerformanceObserver: jest.fn().mockImplementation(callback => {
      const observer = {
        observe: jest.fn(),
        disconnect: jest.fn(),
        _callback: callback,
      };
      observers.push(observer);
      return observer;
    }),
    setResourceLoggingEnabled: jest.fn(),
  };
});

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    histogram: jest.fn(),
    increment: jest.fn(),
  },
}));

jest.mock('#/native/StartupMark', () => ({
  StartupMark: {
    reportFullyDrawn: jest.fn(),
    startProfiling: jest.fn(),
    stopProfiling: jest.fn(() => Promise.resolve('/sdcard/startup.cpuprofile')),
    writeTextFile: jest.fn(() => Promise.resolve('/sdcard/viewmanagers.json')),
  },
}));

jest.mock('#/config/env', () => ({
  env: { API_URL: 'https://api.example.com/graphql' },
}));

// Environment is auto-mocked via jest.setup.js; override `getApiConfig` so
// the perf-API URL matches the assertions below.
import { Environment } from '#/utils/environment';

describe('NativePerformanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    observers.length = 0;
    (Environment.getApiConfig as jest.Mock).mockReturnValue({
      baseUrl: 'https://api.example.com/graphql',
    });
  });

  afterEach(() => {
    NativePerformanceService.cleanup();
    // `cleanup()` deliberately does NOT reset these — production teardown must
    // not, or a remount re-emits a once-per-process metric from the original
    // origin. Tests need a fresh process per case, so they ask explicitly.
    NativePerformanceService.resetStartupLatchesForTesting();
  });

  describe('initialize', () => {
    it('creates 3 PerformanceObservers', () => {
      NativePerformanceService.initialize();

      expect(PerformanceObserver).toHaveBeenCalledTimes(3);
      expect(observers).toHaveLength(3);

      // Verify each observer was told to observe a specific type
      expect(observers[0].observe).toHaveBeenCalledWith({
        type: 'react-native-mark',
        buffered: true,
      });
      expect(observers[1].observe).toHaveBeenCalledWith({
        type: 'measure',
        buffered: true,
      });
      expect(observers[2].observe).toHaveBeenCalledWith({
        type: 'resource',
        buffered: true,
      });

      expect(setResourceLoggingEnabled).toHaveBeenCalledWith(true);
    });

    it('guards against double initialization', () => {
      NativePerformanceService.initialize();
      NativePerformanceService.initialize();

      expect(PerformanceObserver).toHaveBeenCalledTimes(3);
    });
  });

  describe('cleanup', () => {
    it('disconnects all observers and resets state', () => {
      NativePerformanceService.initialize();
      const capturedObservers = [...observers];

      NativePerformanceService.cleanup();

      capturedObservers.forEach(obs => {
        expect(obs.disconnect).toHaveBeenCalled();
      });

      // After cleanup, initialize should work again
      observers.length = 0;
      jest.clearAllMocks();
      NativePerformanceService.initialize();
      expect(PerformanceObserver).toHaveBeenCalledTimes(3);
    });
  });

  describe('mark', () => {
    it('delegates to performance.mark', () => {
      NativePerformanceService.mark('my_mark');
      expect(performance.mark).toHaveBeenCalledWith('my_mark');
    });
  });

  describe('measure', () => {
    it('delegates to performance.measure', () => {
      NativePerformanceService.measure('my_measure', 'start', 'end');
      expect(performance.measure).toHaveBeenCalledWith(
        'my_measure',
        'start',
        'end',
      );
    });

    it('passes undefined endMark when not provided', () => {
      NativePerformanceService.measure('my_measure', 'start');
      expect(performance.measure).toHaveBeenCalledWith(
        'my_measure',
        'start',
        undefined,
      );
    });
  });

  describe('native marks observer', () => {
    it('reports nativeLaunchStart/End to Telemetry.histogram', () => {
      NativePerformanceService.initialize();
      const nativeMarkObserver = observers[0];

      nativeMarkObserver._callback({
        getEntries: () => [
          { name: 'nativeLaunchStart', startTime: 100 },
          { name: 'nativeLaunchEnd', startTime: 350 },
        ],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'app_native_launch_ms',
        250,
        { type: 'native_init' },
      );
    });

    it('reports runJsBundleStart/End to Telemetry.histogram', () => {
      NativePerformanceService.initialize();
      const nativeMarkObserver = observers[0];

      nativeMarkObserver._callback({
        getEntries: () => [
          { name: 'runJsBundleStart', startTime: 400 },
          { name: 'runJsBundleEnd', startTime: 600 },
        ],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'app_js_bundle_load_ms',
        200,
        { type: 'hermes_bytecode' },
      );
    });

    it('reports contentAppeared as time from nativeLaunchStart', () => {
      // The only first-frame number the app has. Every other startup metric
      // begins at JS-bundle entry, so none of them can see a frame at all.
      NativePerformanceService.initialize();

      observers[0]._callback({
        getEntries: () => [
          { name: 'nativeLaunchStart', startTime: 100 },
          { name: 'contentAppeared', startTime: 950 },
        ],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'app_content_appeared_ms',
        850,
      );
    });

    it('reports contentAppeared once, however often the mark is delivered', () => {
      // The observer is `buffered: true` and fires on every batch, so without
      // the one-shot guard a single launch would report repeatedly and skew
      // its own histogram.
      NativePerformanceService.initialize();
      const entries = {
        getEntries: () => [
          { name: 'nativeLaunchStart', startTime: 100 },
          { name: 'contentAppeared', startTime: 950 },
        ],
      };

      observers[0]._callback(entries);
      observers[0]._callback(entries);

      const reports = (Telemetry.histogram as jest.Mock).mock.calls.filter(
        ([name]) => name === 'app_content_appeared_ms',
      );
      expect(reports).toHaveLength(1);
    });

    it('derives a metric from marks delivered in separate notifications', () => {
      // The observer drains its buffer on every emission, so `getEntries()` is
      // only what arrived since the last callback. Requiring both marks in one
      // batch made the metric a hostage to when the observer was constructed —
      // `contentAppeared` rides RN's content-appeared signal, not the startup
      // mark flush, so it is the one that arrives alone.
      NativePerformanceService.initialize();

      observers[0]._callback({
        getEntries: () => [{ name: 'nativeLaunchStart', startTime: 100 }],
      });
      expect(Telemetry.histogram).not.toHaveBeenCalledWith(
        'app_content_appeared_ms',
        expect.anything(),
      );

      observers[0]._callback({
        getEntries: () => [{ name: 'contentAppeared', startTime: 950 }],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'app_content_appeared_ms',
        850,
      );
    });

    it('derives a metric when the marks arrive in the reverse order', () => {
      NativePerformanceService.initialize();

      observers[0]._callback({
        getEntries: () => [{ name: 'contentAppeared', startTime: 950 }],
      });
      observers[0]._callback({
        getEntries: () => [{ name: 'nativeLaunchStart', startTime: 100 }],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'app_content_appeared_ms',
        850,
      );
    });

    it('retains marks across notifications for launch and bundle too', () => {
      // Same fault, same fix: these two only got away with it because their
      // marks happen to be flushed together.
      NativePerformanceService.initialize();

      observers[0]._callback({
        getEntries: () => [
          { name: 'nativeLaunchStart', startTime: 100 },
          { name: 'runJsBundleStart', startTime: 300 },
        ],
      });
      observers[0]._callback({
        getEntries: () => [
          { name: 'nativeLaunchEnd', startTime: 250 },
          { name: 'runJsBundleEnd', startTime: 700 },
        ],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'app_native_launch_ms',
        150,
        { type: 'native_init' },
      );
      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'app_js_bundle_load_ms',
        400,
        { type: 'hermes_bytecode' },
      );
    });

    it('still reports once when a split delivery is repeated', () => {
      NativePerformanceService.initialize();

      const first = {
        getEntries: () => [{ name: 'nativeLaunchStart', startTime: 100 }],
      };
      const second = {
        getEntries: () => [{ name: 'contentAppeared', startTime: 950 }],
      };
      observers[0]._callback(first);
      observers[0]._callback(second);
      observers[0]._callback(second);
      observers[0]._callback(first);

      const reports = (Telemetry.histogram as jest.Mock).mock.calls.filter(
        ([name]) => name === 'app_content_appeared_ms',
      );
      expect(reports).toHaveLength(1);
    });

    it('waits for both marks rather than reporting a partial launch', () => {
      NativePerformanceService.initialize();

      observers[0]._callback({
        getEntries: () => [{ name: 'contentAppeared', startTime: 950 }],
      });

      expect(Telemetry.histogram).not.toHaveBeenCalledWith(
        'app_content_appeared_ms',
        expect.anything(),
      );
    });
  });

  describe('measure observer', () => {
    it('routes screen:Home:interactive to Telemetry.histogram', () => {
      NativePerformanceService.initialize();
      const measObserver = observers[1];

      measObserver._callback({
        getEntries: () => [{ name: 'screen:Home:interactive', duration: 120 }],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'screen_interactive_duration_ms',
        120,
        { screen: 'Home' },
      );
    });

    it('drops the removed mount and transition phases', () => {
      NativePerformanceService.initialize();
      const measObserver = observers[1];

      measObserver._callback({
        getEntries: () => [
          { name: 'screen:Home:mount', duration: 120 },
          { name: 'screen:Home:transition', duration: 120 },
        ],
      });

      // `mount` timed two effects in the same commit and read ~0 on every
      // screen; `transition` came from the identical marks as `interactive`.
      expect(Telemetry.histogram).not.toHaveBeenCalled();
    });

    it('routes component:MyList:render to component_render_duration_ms histogram', () => {
      NativePerformanceService.initialize();
      const measObserver = observers[1];

      measObserver._callback({
        getEntries: () => [{ name: 'component:MyList:render', duration: 15 }],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'component_render_duration_ms',
        15,
        { component: 'MyList' },
      );
    });
  });

  describe('markFullyDrawn', () => {
    const { StartupMark } = jest.requireMock('#/native/StartupMark');
    const START = 1_000_000;

    beforeEach(() => {
      (globalThis as { __APP_START_TIMESTAMP?: number }).__APP_START_TIMESTAMP =
        START;
      jest.spyOn(Date, 'now').mockReturnValue(START + 2200);
    });

    afterEach(() => {
      (Date.now as jest.Mock).mockRestore?.();
      delete (globalThis as { __APP_START_TIMESTAMP?: number })
        .__APP_START_TIMESTAMP;
    });

    it('reports the time from JS entry and tells the platform', () => {
      NativePerformanceService.markFullyDrawn();

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'app_fully_drawn_ms',
        2200,
      );
      // The same moment reported to Android itself, which is what Play Console
      // vitals and Macrobenchmark's timeToFullDisplayMs read.
      expect(StartupMark.reportFullyDrawn).toHaveBeenCalledTimes(1);
    });

    /** Load the service with the profiler reporting a given armed state. */
    const loadWithProfiler = (armed: boolean, probeAttached = true) => {
      jest.resetModules();
      jest.doMock('../startupProfiling', () => ({
        isStartupProfilerArmed: () => armed,
        setStartupProfilerArmed: jest.fn(),
        HERMES_PROFILE_STARTUP: true,
        STARTUP_WINDOW_MS: 10_000,
        STARTUP_PROFILE_FILENAME: 'startup.cpuprofile',
        FALLBACK_PROFILE_FILENAME: 'startup-fallback.cpuprofile',
        VIEW_MANAGER_REPORT_FILENAME: 'viewmanagers.json',
      }));
      jest.doMock('../viewManagerProbe', () => ({
        didViewManagerProbeAttach: () => probeAttached,
        summarizeViewManagerConstants: () => '{"rows":[]}',
      }));
      return {
        svc: require('../NativePerformanceService').NativePerformanceService,
        mark: require('#/native/StartupMark').StartupMark,
        // `resetModules` gives the re-required service a FRESH telemetry mock,
        // so asserting on the outer `Telemetry` would test the wrong object.
        telemetry: require('#/services/telemetry').Telemetry,
      };
    };

    afterEach(() => {
      jest.dontMock('../startupProfiling');
      jest.dontMock('../viewManagerProbe');
      jest.resetModules();
    });

    it('suppresses the histogram while profiling, but still marks the OS', async () => {
      // A profiled run's timings are inflated by sampling. Emitting them would
      // put a poisoned point into the very series used for build-over-build
      // comparison, so the metric is skipped — while `reportFullyDrawn()`,
      // which is the marker rather than the measurement, still fires.
      const { svc, mark, telemetry } = loadWithProfiler(true);

      svc.markFullyDrawn();
      await Promise.resolve();

      // `telemetry`, NOT the outer `Telemetry`: `resetModules` gave the
      // re-required service a fresh mock, and asserting on the stale one made
      // this pass even with the suppression branch deleted outright.
      expect(telemetry.histogram).not.toHaveBeenCalledWith(
        'app_fully_drawn_ms',
        expect.anything(),
      );
      expect(mark.stopProfiling).toHaveBeenCalledWith('startup.cpuprofile');
      expect(mark.reportFullyDrawn).toHaveBeenCalled();
      expect(mark.writeTextFile).toHaveBeenCalledWith(
        'viewmanagers.json',
        '{"rows":[]}',
      );
    });

    it('writes no view-manager report when the probe never attached', async () => {
      // The probe wraps a global that iOS does not install
      // (`useNativeViewConfigsInBridgelessMode` defaults false), so it never
      // attaches there. Writing the report anyway would leave an artifact
      // saying zero, which reads as "measured, found nothing" rather than
      // "cannot be measured on this platform" — the opposite of the truth.
      const { svc, mark } = loadWithProfiler(true, false);

      svc.markFullyDrawn();
      await Promise.resolve();

      expect(mark.writeTextFile).not.toHaveBeenCalled();
      // The profile itself is still written — it is the trace that matters, and
      // it is what proves this call site fired at all.
      expect(mark.stopProfiling).toHaveBeenCalledWith('startup.cpuprofile');
    });

    it('writes the report when the probe attached, even with nothing to report', async () => {
      // "Attached and observed nothing" is a real finding: it says the interop
      // path was instrumented and cost nothing. Gating the report on RECORDS
      // instead of on attachment made `attached: false` — the field the report
      // tells you to read first — impossible to ever emit.
      const { svc, mark } = loadWithProfiler(true, true);

      svc.markFullyDrawn();
      await Promise.resolve();

      expect(mark.writeTextFile).toHaveBeenCalledWith(
        'viewmanagers.json',
        '{"rows":[]}',
      );
    });

    it('still emits the histogram when the build asked to profile but nothing armed', async () => {
      // The build flag is platform-agnostic; the profiler can be inert (no
      // native module on this build). Nothing perturbed the interval, so
      // withholding the metric would leave it with neither a number nor a
      // trace.
      const { svc, mark, telemetry } = loadWithProfiler(false);

      svc.markFullyDrawn();
      await Promise.resolve();

      expect(telemetry.histogram).toHaveBeenCalledWith(
        'app_fully_drawn_ms',
        2200,
      );
      expect(mark.stopProfiling).not.toHaveBeenCalled();
      expect(mark.reportFullyDrawn).toHaveBeenCalled();
    });

    it('fires once — a session has exactly one first meaningful paint', () => {
      // Every list's onLoad calls this; only the first one means anything.
      NativePerformanceService.markFullyDrawn();
      NativePerformanceService.markFullyDrawn();
      NativePerformanceService.markFullyDrawn();

      const reports = (Telemetry.histogram as jest.Mock).mock.calls.filter(
        ([name]) => name === 'app_fully_drawn_ms',
      );
      expect(reports).toHaveLength(1);
      expect(StartupMark.reportFullyDrawn).toHaveBeenCalledTimes(1);
    });

    it('suppresses the metric when the launch stopped for user input', () => {
      // A signed-out cold start where the user spends 45 s typing credentials
      // would otherwise land ~47,000 ms in the same unlabelled series as
      // genuine ~2,000 ms launches. The interval is the person's, not the app's.
      NativePerformanceService.noteInteractiveGate();

      NativePerformanceService.markFullyDrawn();

      expect(Telemetry.histogram).not.toHaveBeenCalledWith(
        'app_fully_drawn_ms',
        expect.anything(),
      );
      // Still the marker: Android's own fully-drawn vital is not a measurement
      // this code gets to withhold.
      expect(StartupMark.reportFullyDrawn).toHaveBeenCalledTimes(1);
    });

    it('reports normally when no gate asked the user for anything', () => {
      // The negative above must be able to fail — without this pair, deleting
      // the suppression branch would look the same as keeping it.
      NativePerformanceService.markFullyDrawn();

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'app_fully_drawn_ms',
        2200,
      );
    });

    it('reports nothing when there is no start timestamp to measure from', () => {
      delete (globalThis as { __APP_START_TIMESTAMP?: number })
        .__APP_START_TIMESTAMP;

      NativePerformanceService.markFullyDrawn();

      expect(Telemetry.histogram).not.toHaveBeenCalledWith(
        'app_fully_drawn_ms',
        expect.anything(),
      );
      expect(StartupMark.reportFullyDrawn).not.toHaveBeenCalled();
    });

    describe('the startup window bound', () => {
      it('emits at the edge of the window', () => {
        // Inclusive: the bound is where startup ENDS, so a launch landing
        // exactly on it is still a launch.
        (Date.now as jest.Mock).mockReturnValue(START + 10_000);

        NativePerformanceService.markFullyDrawn();

        expect(Telemetry.histogram).toHaveBeenCalledWith(
          'app_fully_drawn_ms',
          10_000,
        );
        expect(Telemetry.increment).not.toHaveBeenCalledWith(
          'startup_window_exceeded_total',
        );
      });

      it('emits nothing past the window, and counts the drop', () => {
        // `HomeTabs` is lazy, so at cold start only the Pantry tab mounts —
        // the other two instrumented lists can ONLY latch after a navigation,
        // and the origin is never cleared. Opening the shopping list twenty
        // seconds in wrote ~20,000 ms into the same series as ~2,000 ms
        // launches.
        (Date.now as jest.Mock).mockReturnValue(START + 20_000);

        NativePerformanceService.markFullyDrawn();

        expect(Telemetry.histogram).not.toHaveBeenCalledWith(
          'app_fully_drawn_ms',
          expect.anything(),
        );
        // Counted, not silently dropped: an absent value and an excluded one
        // read identically on a dashboard.
        expect(Telemetry.increment).toHaveBeenCalledWith(
          'startup_window_exceeded_total',
        );
        // Still the marker — the OS vital is not ours to withhold.
        expect(StartupMark.reportFullyDrawn).toHaveBeenCalledTimes(1);
      });

      it('counts an over-window launch exactly once', () => {
        (Date.now as jest.Mock).mockReturnValue(START + 30_000);

        NativePerformanceService.markFullyDrawn();
        NativePerformanceService.markFullyDrawn();

        const drops = (Telemetry.increment as jest.Mock).mock.calls.filter(
          ([name]) => name === 'startup_window_exceeded_total',
        );
        expect(drops).toHaveLength(1);
      });
    });

    describe('the once-per-process guarantee', () => {
      it('does not re-emit after a cleanup/remount cycle', () => {
        // The regression: `cleanup()` reset the latch while the origin it is
        // measured against (`__APP_START_TIMESTAMP`) is deliberately never
        // cleared, so a remount — App unmount, Fast Refresh — emitted a second
        // value covering minutes of session time, into a series documented as
        // at most once per process.
        NativePerformanceService.markFullyDrawn();
        expect(Telemetry.histogram).toHaveBeenCalledWith(
          'app_fully_drawn_ms',
          2200,
        );

        NativePerformanceService.cleanup();
        NativePerformanceService.initialize();
        (Date.now as jest.Mock).mockReturnValue(START + 400_000);
        NativePerformanceService.markFullyDrawn();

        const reports = (Telemetry.histogram as jest.Mock).mock.calls.filter(
          ([name]) => name === 'app_fully_drawn_ms',
        );
        expect(reports).toHaveLength(1);
      });

      it('keeps the interactive-gate suppression across a cleanup', () => {
        // Clearing the flag in `cleanup()` additionally let a re-fired run
        // report a launch that DID stop at sign-in as though it had not.
        NativePerformanceService.noteInteractiveGate();
        NativePerformanceService.cleanup();
        NativePerformanceService.markFullyDrawn();

        expect(Telemetry.histogram).not.toHaveBeenCalledWith(
          'app_fully_drawn_ms',
          expect.anything(),
        );
      });
    });
  });

  describe('resource observer', () => {
    it('filters out GraphQL host', () => {
      NativePerformanceService.initialize();
      const resObserver = observers[2];

      resObserver._callback({
        getEntries: () => [
          { name: 'https://api.example.com/graphql', duration: 200 },
        ],
      });

      // Should NOT report because the host matches the GraphQL host
      expect(Telemetry.histogram).not.toHaveBeenCalled();
    });

    it('reports non-GraphQL resources', () => {
      NativePerformanceService.initialize();
      const resObserver = observers[2];

      resObserver._callback({
        getEntries: () => [
          { name: 'https://cdn.example.com/image.png', duration: 150 },
        ],
      });

      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'http_request_duration_ms',
        150,
        { host: 'cdn.example.com' },
      );
    });
  });
});
