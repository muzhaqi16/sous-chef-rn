import { NativeModules, Platform } from 'react-native';

/**
 * Resolved per call, NEVER captured at module scope: `index.js` imports this in
 * its first few lines, so a destructured binding freezes whatever the registry
 * held then — an `undefined` captured there makes every method a silent no-op
 * for the process. Not gated on `Platform.OS`; each method gates on itself.
 */
const nativeModule = (): {
  reportFullyDrawn?: () => void;
  startProfiling?: () => boolean;
  stopProfiling?: (filename: string) => Promise<string>;
  writeTextFile?: (filename: string, contents: string) => Promise<string>;
} | null => NativeModules.StartupMarkModule ?? null;

/**
 * Tells the PLATFORM the app is fully drawn — distinct from our own
 * `app_fully_drawn_ms`. Android calls `Activity.reportFullyDrawn()`, feeding
 * Play vitals and Macrobenchmark. iOS deliberately does nothing: no API accepts
 * an app-declared signal, and a signpost needs an XCUITest target to read it.
 */
export const StartupMark = {
  reportFullyDrawn() {
    if (Platform.OS === 'android') {
      nativeModule()?.reportFullyDrawn?.();
    }
  },

  /**
   * Arm Hermes' sampling profiler from `index.js` — startup is over before the
   * dev menu opens. Returns whether sampling actually STARTED, which decides
   * whether timings are too perturbed to emit `app_fully_drawn_ms`; the method
   * merely existing proves nothing, since arming can fail.
   */
  startProfiling(): boolean {
    const start = nativeModule()?.startProfiling;
    if (!start) return false;
    return start() === true;
  },

  /** Write a text file beside the profile (release strips `console`). */
  writeTextFile(filename: string, contents: string): Promise<string | null> {
    const write = nativeModule()?.writeTextFile;
    return write ? write(filename, contents) : Promise.resolve(null);
  },

  /**
   * Stop profiling and write the trace. REJECTS when the native cannot stop,
   * rather than resolving `null` — a build that can start but not stop would
   * otherwise clear the fallback timer, leave the sampler running all session,
   * and report success while producing no trace.
   */
  stopProfiling(filename: string): Promise<string | null> {
    const stop = nativeModule()?.stopProfiling;
    if (!stop) {
      return Promise.reject(
        new Error(
          'StartupMark.stopProfiling is unavailable in this build: sampling ' +
            'was started and cannot be stopped, so this session’s timings ' +
            'are perturbed and no trace will be written.',
        ),
      );
    }
    return stop(filename);
  },
};
