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
import { Environment } from '#/utils/environment';
import Config from 'react-native-config';

let initialized = false;
let nativeMarkObserver: InstanceType<typeof PerformanceObserver> | null = null;
let measureObserver: InstanceType<typeof PerformanceObserver> | null = null;
let resourceObserver: InstanceType<typeof PerformanceObserver> | null = null;

// Duplicate-prevention flags for one-shot native metrics
let reportedNativeLaunch = false;
let reportedBundleLoad = false;
let reportedContentAppeared = false;

function getGraphQLHost(): string {
  const apiConfig = Environment.getApiConfig();
  try {
    return new URL(Config.API_URL || apiConfig.baseUrl).host;
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

  if (!reportedContentAppeared) {
    const contentAppeared = find('contentAppeared');
    if (contentAppeared) {
      reportedContentAppeared = true;
      Telemetry.histogram(
        'app_content_appeared_ms',
        contentAppeared.startTime,
        { type: 'content_appeared' },
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
  },

  mark(name: string) {
    return performance.mark(name);
  },

  measure(name: string, startMark: string, endMark?: string) {
    return performance.measure(name, startMark, endMark);
  },
};
