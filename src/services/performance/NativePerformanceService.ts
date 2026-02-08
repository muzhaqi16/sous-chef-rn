/**
 * Native Performance Service
 *
 * Captures native-level startup metrics using react-native-performance
 * and reports them to the telemetry pipeline.
 *
 * Provides mark/measure helpers for custom user-perceived milestones.
 */
import performance, { PerformanceObserver } from 'react-native-performance';
import type { PerformanceEntry } from 'react-native-performance';
import { Telemetry } from '#/services/telemetry';

/** Known React Native startup marks emitted by the framework */
const NATIVE_MARKS = {
  nativeLaunchStart: 'nativeLaunchStart',
  nativeLaunchEnd: 'nativeLaunchEnd',
  downloadStart: 'downloadStart',
  downloadEnd: 'downloadEnd',
  runJsBundleStart: 'runJsBundleStart',
  runJsBundleEnd: 'runJsBundleEnd',
} as const;

let initialized = false;
let observer: InstanceType<typeof PerformanceObserver> | null = null;

function reportNativeMarks() {
  const entries = performance.getEntriesByType('react-native-mark');

  const findMark = (name: string) => entries.find(e => e.name === name);

  const launchStart = findMark(NATIVE_MARKS.nativeLaunchStart);
  const launchEnd = findMark(NATIVE_MARKS.nativeLaunchEnd);
  const bundleStart = findMark(NATIVE_MARKS.runJsBundleStart);
  const bundleEnd = findMark(NATIVE_MARKS.runJsBundleEnd);

  if (launchStart && launchEnd) {
    const nativeLaunchMs = launchEnd.startTime - launchStart.startTime;
    Telemetry.histogram('app_native_launch_ms', nativeLaunchMs, {
      type: 'native_init',
    });
  }

  if (bundleStart && bundleEnd) {
    const bundleLoadMs = bundleEnd.startTime - bundleStart.startTime;
    Telemetry.histogram('app_js_bundle_load_ms', bundleLoadMs, {
      type: 'hermes_bytecode',
    });
  }
}

export const NativePerformanceService = {
  /**
   * Initialize the service. Should be called once after Telemetry.initialize().
   * Observes native startup marks and reports them to telemetry.
   */
  initialize() {
    if (initialized) return;
    initialized = true;

    // Report any marks that were already emitted before we initialized
    reportNativeMarks();

    // Observe future entries for any marks that arrive late
    observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const hasRelevantMark = entries.some(
        (entry: PerformanceEntry) => entry.entryType === 'react-native-mark',
      );
      if (hasRelevantMark) {
        reportNativeMarks();
      }
    });
    observer.observe({ type: 'react-native-mark', buffered: true });
  },

  /**
   * Create a performance mark for a custom milestone.
   */
  mark(name: string) {
    return performance.mark(name);
  },

  /**
   * Measure duration between two marks.
   */
  measure(name: string, startMark: string, endMark?: string) {
    return performance.measure(name, startMark, endMark);
  },

  /**
   * Cleanup observer on shutdown.
   */
  cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    initialized = false;
  },
};
