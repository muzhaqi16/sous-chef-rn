/**
 * Captures native startup metrics, routes custom marks/measures to telemetry,
 * and tracks HTTP resource timing via `react-native-performance`.
 */
import performance, {
  PerformanceObserver,
  setResourceLoggingEnabled,
} from 'react-native-performance';
import type { PerformanceEntry } from 'react-native-performance';
import { AppState, type NativeEventSubscription } from 'react-native';
import { Telemetry } from '#/services/telemetry';
import { StartupMark } from '#/native/StartupMark';
import {
  isStartupProfilerArmed,
  STARTUP_PROFILE_FILENAME,
  STARTUP_WINDOW_MS,
} from './startupProfiling';
import {
  captureStartupProfile,
  captureStartupProfileOnBackground,
} from './startupProfileCapture';
import { Environment, logger } from '#/utils/environment';
import { env } from '#/config/env';

let initialized = false;
let nativeMarkObserver: InstanceType<typeof PerformanceObserver> | null = null;
let measureObserver: InstanceType<typeof PerformanceObserver> | null = null;
let resourceObserver: InstanceType<typeof PerformanceObserver> | null = null;
let appStateSubscription: NativeEventSubscription | null = null;

// Duplicate-prevention flags for one-shot native metrics
let reportedNativeLaunch = false;
let reportedBundleLoad = false;
let reportedContentAppeared = false;
let reportedFullyDrawn = false;

/**
 * Whether this launch stopped for user input (sign-in, verification, onboarding,
 * biometric setup) before showing content. Those gates put an unbounded human
 * interval inside `app_fully_drawn_ms`, so it is suppressed. Process-scoped like
 * the metric, and set by the navigator so one decision covers every gate.
 */
let sawInteractiveGate = false;

/**
 * Startup marks retained ACROSS observer notifications: the observer drains its
 * buffer on every emission, so `list.getEntries()` holds only what arrived since
 * the last callback. Without this, a metric derived from two marks needs both in
 * the same notification — `contentAppeared` routinely arrives alone.
 */
const observedMarks = new Map<string, number>();

function getGraphQLHost(): string {
  const apiConfig = Environment.getApiConfig();
  try {
    return new URL(env.API_URL || apiConfig.baseUrl).host;
  } catch {
    return '';
  }
}

function handleNativeMarks(entries: PerformanceEntry[]) {
  for (const entry of entries) {
    if (!observedMarks.has(entry.name)) {
      observedMarks.set(entry.name, entry.startTime);
    }
  }
  const find = (name: string) => observedMarks.get(name);

  if (!reportedNativeLaunch) {
    const launchStart = find('nativeLaunchStart');
    const launchEnd = find('nativeLaunchEnd');
    if (launchStart !== undefined && launchEnd !== undefined) {
      reportedNativeLaunch = true;
      Telemetry.histogram('app_native_launch_ms', launchEnd - launchStart, {
        type: 'native_init',
      });
    }
  }

  if (!reportedBundleLoad) {
    const bundleStart = find('runJsBundleStart');
    const bundleEnd = find('runJsBundleEnd');
    if (bundleStart !== undefined && bundleEnd !== undefined) {
      reportedBundleLoad = true;
      Telemetry.histogram('app_js_bundle_load_ms', bundleEnd - bundleStart, {
        type: 'hermes_bytecode',
      });
    }
  }

  // First frame: `contentAppeared` is RN's own root-view-on-screen signal and
  // means the same on both platforms. Measured from `nativeLaunchStart` so it
  // shares an origin with `app_native_launch_ms` and the two are subtractable;
  // the iOS origin is an approximation (contract row in docs/telemetry-setup.md).
  if (!reportedContentAppeared) {
    const launchStart = find('nativeLaunchStart');
    const contentAppeared = find('contentAppeared');
    if (launchStart !== undefined && contentAppeared !== undefined) {
      reportedContentAppeared = true;
      Telemetry.histogram(
        'app_content_appeared_ms',
        contentAppeared - launchStart,
      );
    }
  }
}

function handleMeasure(entry: PerformanceEntry) {
  const { name, duration } = entry;

  // screen:<name>:<phase> → route to screen histograms
  if (name.startsWith('screen:')) {
    const parts = name.split(':');
    const screen = parts[1];
    const phase = parts[2];

    // Only `interactive` is routed: `mount` times two effects in the same commit
    // and reads ~0 everywhere, `transition` uses marks identical to this one.
    if (phase === 'interactive') {
      Telemetry.histogram('screen_interactive_duration_ms', duration, {
        screen,
      });
    }
    return;
  }

  // component:<name>:render → component render histogram. No producer today:
  // React strips `<Profiler onRender>` from ReactFabric-prod, so `useCommitTracking`
  // reports the weaker `component_commit_gap_ms` instead.
  if (name.startsWith('component:')) {
    const component = name.split(':')[1];
    Telemetry.histogram('component_render_duration_ms', duration, {
      component,
    });
    return;
  }

  // gql:* measures are skipped — telemetryLink reports directly with full labels
}

function handleResource(entry: PerformanceEntry) {
  const { name: url, duration } = entry;

  // Filter out GraphQL endpoint to avoid double-counting with graphql_request_duration_ms
  const gqlHost = getGraphQLHost();
  if (gqlHost) {
    try {
      const resourceHost = new URL(url).host;
      if (resourceHost === gqlHost) {
        return;
      }
    } catch {
      // Invalid URL — report it
    }
  }

  let host = 'unknown';
  try {
    host = new URL(url).host;
  } catch {
    // Keep 'unknown'
  }

  Telemetry.histogram('http_request_duration_ms', duration, { host });
}

export const NativePerformanceService = {
  initialize() {
    if (initialized) {
      return;
    }
    initialized = true;

    // 1. Native mark observer (buffered — replays marks emitted before JS ran)
    nativeMarkObserver = new PerformanceObserver(list => {
      handleNativeMarks(list.getEntries());
    });
    nativeMarkObserver.observe({ type: 'react-native-mark', buffered: true });

    // 2. Measure observer (buffered — picks up any measures created before init)
    measureObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        handleMeasure(entry);
      }
    });
    measureObserver.observe({ type: 'measure', buffered: true });

    // 3. Resource observer (buffered — captures HTTP/fetch timing)
    setResourceLoggingEnabled(true);
    resourceObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        handleResource(entry);
      }
    });
    resourceObserver.observe({ type: 'resource', buffered: true });

    // 4. Stop an armed profiler if the app backgrounds before first meaningful
    // paint. Registered here because RN is loaded — the arming module cannot
    // import it without reordering the startup origin.
    if (isStartupProfilerArmed()) {
      appStateSubscription = AppState.addEventListener('change', state => {
        if (state === 'background') {
          captureStartupProfileOnBackground();
        }
      });
    }
  },

  cleanup() {
    nativeMarkObserver?.disconnect();
    measureObserver?.disconnect();
    resourceObserver?.disconnect();
    appStateSubscription?.remove();
    nativeMarkObserver = null;
    measureObserver = null;
    resourceObserver = null;
    appStateSubscription = null;
    initialized = false;
    reportedNativeLaunch = false;
    reportedBundleLoad = false;
    reportedContentAppeared = false;
    observedMarks.clear();

    // `reportedFullyDrawn` and `sawInteractiveGate` are deliberately NOT reset:
    // they are PROCESS-scoped, like the `__APP_START_TIMESTAMP` they measure
    // against. Resetting them lets a remount emit a second `app_fully_drawn_ms`
    // measured from the original JS entry. `useStartupInit.ts` does the same for
    // `reportedStartupDuration`.
  },

  /**
   * First meaningful paint — real content, not RN's first frame. Fired once per
   * session by `useFlashListPerformance` on `hasFinishedLayout && hasRealContent`;
   * NOT `onLoad`, which a sentinel-only skeleton layout consumes. Known scope: a
   * launch that never renders an instrumented list never fires this.
   */
  markFullyDrawn() {
    const startTs = (globalThis as { __APP_START_TIMESTAMP?: number })
      .__APP_START_TIMESTAMP;
    if (reportedFullyDrawn || !startTs) return;
    reportedFullyDrawn = true;

    const elapsed = Date.now() - startTs;

    // Past the window this is not a launch: `HomeTabs` is lazy, so the other
    // instrumented lists can only latch after a navigation. Counted rather than
    // dropped in silence — absent and excluded read alike on a dashboard.
    if (elapsed > STARTUP_WINDOW_MS) {
      Telemetry.increment('startup_window_exceeded_total');
      logger.info(
        'app_fully_drawn_ms not emitted: outside the startup window',
        {
          elapsed,
          windowMs: STARTUP_WINDOW_MS,
        },
      );
      StartupMark.reportFullyDrawn();
      return;
    }

    // Keyed on whether the profiler ARMED, not on the build flag: a flagged
    // build that armed nothing would lose the metric and gain no trace.
    if (isStartupProfilerArmed()) {
      // No histogram on a profiled run — sampling inflates the interval being
      // measured. This is the one profile whose window is `app_fully_drawn_ms`'s.
      captureStartupProfile(STARTUP_PROFILE_FILENAME);
    } else if (sawInteractiveGate) {
      // Suppressed, not labelled: the metric is unlabelled by design.
      logger.info('app_fully_drawn_ms suppressed: launch required user input');
    } else {
      Telemetry.histogram('app_fully_drawn_ms', elapsed);
    }

    // Android-only platform marker; fires either way — marker, not measurement.
    StartupMark.reportFullyDrawn();
  },

  /**
   * Test seam for the two PROCESS-scoped latches. Separate from `cleanup()`,
   * which must not reset them (see the note there).
   */
  resetStartupLatchesForTesting() {
    reportedFullyDrawn = false;
    sawInteractiveGate = false;
  },

  /**
   * Called by the navigator for every gate that stops for user input. May in
   * principle arrive after `markFullyDrawn`, so it gates nothing.
   */
  noteInteractiveGate() {
    sawInteractiveGate = true;
  },

  mark(name: string) {
    return performance.mark(name);
  },

  measure(name: string, startMark: string, endMark?: string) {
    return performance.measure(name, startMark, endMark);
  },
};
