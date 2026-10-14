import { Platform } from 'react-native';
import { nativeMethod } from './nativeModule';

// The profiling methods exist on both platforms: each gates on the method
// being there, never on `Platform.OS`.
const MODULE = 'StartupMarkModule';

const asPath = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

/**
 * Tells the PLATFORM the app is fully drawn — distinct from our own
 * `app_fully_drawn_ms`. Android calls `Activity.reportFullyDrawn()`, feeding
 * Play vitals and Macrobenchmark. iOS deliberately does nothing: no API accepts
 * an app-declared signal, and a signpost needs an XCUITest target to read it.
 */
export const StartupMark = {
  reportFullyDrawn() {
    if (Platform.OS === 'android') {
      nativeMethod(MODULE, 'reportFullyDrawn')?.();
    }
  },

  /**
   * Arm Hermes' sampling profiler from `index.js` — startup is over before the
   * dev menu opens. Returns whether sampling actually STARTED, which decides
   * whether timings are too perturbed to emit `app_fully_drawn_ms`; the method
   * merely existing proves nothing, since arming can fail.
   */
  startProfiling(): boolean {
    return nativeMethod(MODULE, 'startProfiling')?.() === true;
  },

  /** Write a text file beside the profile (release strips `console`). */
  async writeTextFile(
    filename: string,
    contents: string,
  ): Promise<string | null> {
    const write = nativeMethod(MODULE, 'writeTextFile');
    return write ? asPath(await write(filename, contents)) : null;
  },

  /**
   * Stop profiling and write the trace. REJECTS when the native cannot stop,
   * rather than resolving `null` — a build that can start but not stop would
   * otherwise clear the fallback timer, leave the sampler running all session,
   * and report success while producing no trace.
   */
  async stopProfiling(filename: string): Promise<string | null> {
    const stop = nativeMethod(MODULE, 'stopProfiling');
    if (!stop) {
      throw new Error(
        'StartupMark.stopProfiling is unavailable in this build: sampling ' +
          'was started and cannot be stopped, so this session’s timings ' +
          'are perturbed and no trace will be written.',
      );
    }
    return asPath(await stop(filename));
  },
};
