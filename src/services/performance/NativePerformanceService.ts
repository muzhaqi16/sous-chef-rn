/**
 * Native Performance Service
 *
 * Central observer that captures native startup metrics, routes custom
 * marks/measures to telemetry, and tracks HTTP resource timing using
 * `react-native-performance`.
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
 * Whether this launch stopped to ask the user for something before it could
 * show content — sign-in, email verification, onboarding, biometric setup.
 *
 * `app_fully_drawn_ms` measures how long the APP took, and these gates put an
 * unbounded human interval inside that window: a signed-out cold start where
 * someone spends 45 s typing credentials landed ~47,000 ms in the same
 * unlabelled series as genuine ~2,000 ms launches. The flag is process-scoped
 * because the metric is, and it is set by the navigator rather than by any one
 * screen so that every gate is covered by one decision.
 */
let sawInteractiveGate = false;

/**
 * Startup marks observed so far, retained ACROSS observer notifications.
 *
 * The observer drains its buffer on every emission (`takeRecords()` in
 * react-native-performance's performance-observer), so `list.getEntries()` is
 * only the marks that arrived since the last callback — not everything seen. A
 * metric derived from two marks therefore required them to land in the same
 * notification, which is a fact about when the observer was constructed, not
 * about the marks. `contentAppeared` is emitted on RN's own content-appeared
 * signal, independently of the startup mark flush, so it is the one most likely
 * to arrive alone: the metric was then lost for the whole session, because the
 * one-shot guard stayed false while `nativeLaunchStart` never came back.
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

  // First frame. `contentAppeared` is React Native's own signal that the root
  // component's view is on screen — `RCTContentDidAppearNotification` on iOS,
  // `ReactMarker.CONTENT_APPEARED` on Android — so it means the same thing on
  // both platforms. `react-native-performance` has always emitted it and this
  // app never read it, which left us with no first-frame number at all: every
  // other startup metric here begins at JS-bundle entry, so none of them can
  // see a frame.
  //
  // Measured from `nativeLaunchStart` so it shares an origin with
  // `app_native_launch_ms` and the two are subtractable. Note the iOS origin is
  // an approximation — see the contract row in docs/telemetry-setup.md.
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

    // Only `interactive` is routed. `mount` and `transition` used to be too:
    // `mount` timed two effects in the same commit and read ~0 on every screen,
    // and `transition` was measured from the identical marks as `interactive`,
    // so it was a duplicate series under a second name. See
    // `useScreenTransition`.
    if (phase === 'interactive') {
      Telemetry.histogram('screen_interactive_duration_ms', duration, {
        screen,
      });
    }
    return;
  }

  // component:<name>:render → route to component render histogram.
  // No producer today: nothing emits a `component:*:render` measure, so this
  // metric is never written. Kept because the name is correct for what it would
  // carry — a true render duration. `useCommitTracking` reports the different,
  // weaker `component_commit_gap_ms` instead, because React strips
  // `<Profiler onRender>` from ReactFabric-prod.
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

    // 4. Stop an armed profiler if the app leaves the foreground before any
    // list reports first meaningful paint. Registered here, where React Native
    // is already loaded — the arming module runs as the bundle's second
    // require, where importing RN would reorder evaluation ahead of the
    // startup origin. The time-based fallback covers runs where this never
    // runs at all.
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

    // `reportedFullyDrawn` and `sawInteractiveGate` are deliberately NOT reset.
    // They are scoped to the PROCESS, like the origin they are measured against
    // (`__APP_START_TIMESTAMP`, which nothing clears). Resetting them while the
    // origin stood made a remount — App unmount, Fast Refresh, any remount of
    // the hook that owns this cleanup — emit a second `app_fully_drawn_ms`
    // measured from the original JS entry, i.e. minutes of session time in a
    // series documented as at most once per process; clearing the gate flag
    // additionally let a re-fired run report a launch that DID stop at sign-in
    // as though it had not. Between no measurement after a remount and a wrong
    // one, only the first is acceptable. `useStartupInit.ts` makes the same
    // choice for `reportedStartupDuration`.
  },

  /**
   * The app is showing real content — not just RN's first frame.
   *
   * `app_content_appeared_ms` is TTID: React Native's root view is mounted,
   * which says nothing about whether the screen's data has arrived. On the
   * pantry those are ~500 ms apart on a real device, and the gap is the part
   * users actually notice — the header paints while the list is still empty.
   *
   * Called from `useFlashListPerformance`, by the effect that fires once
   * `hasFinishedLayout && hasRealContent` — layout has committed AND what was
   * laid out is data, not a skeleton. Whichever instrumented list the launch
   * lands on first claims it, so it means "first meaningful paint, whichever
   * screen that was". One-shot: a session has exactly one.
   *
   * NOT `onLoad`: that fires once per mount, and a sentinel-only skeleton
   * layout consumes it before any row exists.
   *
   * KNOWN SCOPE: a launch that never renders a list — signed out, or straight
   * into a non-list detail screen — never fires this, so the metric describes
   * signed-in launches. That is the right scope for a cold-start baseline of a
   * list-first app; firing it on any screen instead would make the number mean
   * different things on different launches, which is worse than a gap.
   */
  markFullyDrawn() {
    const startTs = (globalThis as { __APP_START_TIMESTAMP?: number })
      .__APP_START_TIMESTAMP;
    if (reportedFullyDrawn || !startTs) return;
    reportedFullyDrawn = true;

    const elapsed = Date.now() - startTs;

    // Past the window this is not a launch any more. `HomeTabs` is lazy, so at
    // cold start only the Pantry tab mounts — the other two instrumented lists
    // can ONLY latch after a navigation, and `__APP_START_TIMESTAMP` is never
    // cleared. Without this bound, opening the shopping list twenty seconds in
    // wrote ~20,000 ms into the same series as ~2,000 ms launches.
    //
    // Counted rather than dropped in silence: an absent value and an excluded
    // one read identically on a dashboard, and the rate here is the evidence
    // for whether `STARTUP_WINDOW_MS` is set right.
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

    // Keyed on whether the profiler ARMED, not on the build flag. Both
    // platforms can profile, but neither always succeeds — so a flagged build
    // that armed nothing would otherwise lose the metric and gain no trace.
    if (isStartupProfilerArmed()) {
      // Deliberately NO histogram on a profiled run. Sampling inflates the very
      // interval being measured, and one poisoned sample in a series whose
      // whole purpose is build-over-build comparison is worse than a gap.
      // This is the profile whose window really is `app_fully_drawn_ms`'s;
      // every other stop path writes under a different name.
      captureStartupProfile(STARTUP_PROFILE_FILENAME);
    } else if (sawInteractiveGate) {
      // The window contains time spent waiting on a person, not on the app.
      // Suppressed rather than labelled: the metric is unlabelled by design and
      // both the contract row and the dashboards assume that, so a gap here is
      // cheaper than a dimension everything downstream has to learn.
      logger.info('app_fully_drawn_ms suppressed: launch required user input');
    } else {
      Telemetry.histogram('app_fully_drawn_ms', elapsed);
    }

    // Same moment, reported to the platform's own tooling — Android only.
    // Fires either way: it is the marker, not the measurement.
    StartupMark.reportFullyDrawn();
  },

  /**
   * Test seam for the two PROCESS-scoped startup latches.
   *
   * Deliberately separate from `cleanup()`: production teardown must not reset
   * these, or a remount re-emits a once-per-process metric measured from the
   * original JS entry (see the note in `cleanup`). A test needs a fresh process
   * per case and has no other way to get one, so it says so explicitly here
   * rather than borrowing a production path that must not do this.
   */
  resetStartupLatchesForTesting() {
    reportedFullyDrawn = false;
    sawInteractiveGate = false;
  },

  /**
   * Record that this launch stopped for user input before showing content.
   *
   * Called by the navigator for every gate that does so (auth, verification,
   * onboarding, biometric setup). Must be able to arrive AFTER `markFullyDrawn`
   * in principle, so it is not a precondition of anything — but in practice the
   * gate renders long before any instrumented list does.
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
