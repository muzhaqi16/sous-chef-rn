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
import { Telemetry } from '#/services/telemetry';
import { StartupMark } from '#/native/StartupMark';
import {
  HERMES_PROFILE_STARTUP,
  STARTUP_PROFILE_FILENAME,
  VIEW_MANAGER_REPORT_FILENAME,
} from './startupProfiling';
import {
  hasViewManagerRecords,
  summarizeViewManagerConstants,
} from './viewManagerProbe';
import { Environment, logger } from '#/utils/environment';
import { env } from '#/config/env';

let initialized = false;
let nativeMarkObserver: InstanceType<typeof PerformanceObserver> | null = null;
let measureObserver: InstanceType<typeof PerformanceObserver> | null = null;
let resourceObserver: InstanceType<typeof PerformanceObserver> | null = null;

// Duplicate-prevention flags for one-shot native metrics
let reportedNativeLaunch = false;
let reportedBundleLoad = false;
let reportedContentAppeared = false;
let reportedFullyDrawn = false;

function getGraphQLHost(): string {
  const apiConfig = Environment.getApiConfig();
  try {
    return new URL(env.API_URL || apiConfig.baseUrl).host;
  } catch {
    return '';
  }
}

function handleNativeMarks(entries: PerformanceEntry[]) {
  const find = (name: string) => entries.find(e => e.name === name);

  if (!reportedNativeLaunch) {
    const launchStart = find('nativeLaunchStart');
    const launchEnd = find('nativeLaunchEnd');
    if (launchStart && launchEnd) {
      reportedNativeLaunch = true;
      Telemetry.histogram(
        'app_native_launch_ms',
        launchEnd.startTime - launchStart.startTime,
        { type: 'native_init' },
      );
    }
  }

  if (!reportedBundleLoad) {
    const bundleStart = find('runJsBundleStart');
    const bundleEnd = find('runJsBundleEnd');
    if (bundleStart && bundleEnd) {
      reportedBundleLoad = true;
      Telemetry.histogram(
        'app_js_bundle_load_ms',
        bundleEnd.startTime - bundleStart.startTime,
        { type: 'hermes_bytecode' },
      );
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
    if (launchStart && contentAppeared) {
      reportedContentAppeared = true;
      Telemetry.histogram(
        'app_content_appeared_ms',
        contentAppeared.startTime - launchStart.startTime,
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

    switch (phase) {
      case 'mount':
        Telemetry.histogram('screen_mount_duration_ms', duration, { screen });
        break;
      case 'interactive':
        Telemetry.histogram('screen_interactive_duration_ms', duration, {
          screen,
        });
        break;
      case 'transition':
        Telemetry.histogram('screen_transition_duration_ms', duration, {
          screen,
        });
        break;
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
  },

  cleanup() {
    nativeMarkObserver?.disconnect();
    measureObserver?.disconnect();
    resourceObserver?.disconnect();
    nativeMarkObserver = null;
    measureObserver = null;
    resourceObserver = null;
    initialized = false;
    reportedNativeLaunch = false;
    reportedBundleLoad = false;
    reportedContentAppeared = false;
    reportedFullyDrawn = false;
  },

  /**
   * The app is showing real content — not just RN's first frame.
   *
   * `app_content_appeared_ms` is TTID: React Native's root view is mounted,
   * which says nothing about whether the screen's data has arrived. On the
   * pantry those are ~500 ms apart on a real device, and the gap is the part
   * users actually notice — the header paints while the list is still empty.
   *
   * Called from the first list that finishes loading in a session
   * (`useFlashListPerformance`'s `onLoad`), so it means "first meaningful
   * paint, whichever screen that was". One-shot: a session has exactly one.
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

    if (HERMES_PROFILE_STARTUP) {
      // Deliberately NO histogram on a profiled run. Sampling inflates the very
      // interval being measured, and one poisoned sample in a series whose
      // whole purpose is build-over-build comparison is worse than a gap.
      // Only when the probe actually observed something. On iOS it never does
      // — the global it wraps is not installed there — and writing an empty
      // report would read as "measured, found nothing" rather than "this cannot
      // be measured on this platform".
      if (hasViewManagerRecords()) {
        StartupMark.writeTextFile(
          VIEW_MANAGER_REPORT_FILENAME,
          summarizeViewManagerConstants(),
        ).catch(() => {});
      }
      StartupMark.stopProfiling(STARTUP_PROFILE_FILENAME)
        .then(path => {
          logger.info('Hermes startup profile written', { path });
        })
        .catch((error: unknown) => {
          logger.warn('Failed to write Hermes startup profile', { error });
        });
    } else {
      Telemetry.histogram('app_fully_drawn_ms', Date.now() - startTs);
    }

    // Same moment, reported to the platform's own tooling — Android only.
    // Fires either way: it is the marker, not the measurement.
    StartupMark.reportFullyDrawn();
  },

  mark(name: string) {
    return performance.mark(name);
  },

  measure(name: string, startMark: string, endMark?: string) {
    return performance.measure(name, startMark, endMark);
  },
};
