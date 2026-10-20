import { Platform } from 'react-native';
import { nativeMethod } from './nativeModule';

// The profiling methods exist on both platforms: each gates on the method
// being there, never on `Platform.OS`.
const MODULE = 'StartupMarkModule';

const asPath = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

/**
 * Tells the PLATFORM the app is fully drawn (Play vitals, Macrobenchmark),
 * distinct from our `app_fully_drawn_ms`. iOS has no API that accepts an
 * app-declared signal, so it does nothing.
 */
export const StartupMark = {
  reportFullyDrawn() {
    if (Platform.OS === 'android') {
      nativeMethod(MODULE, 'reportFullyDrawn')?.();
    }
  },

  /**
   * Arms Hermes' sampling profiler from `index.js`, as startup is over before
   * the dev menu opens. Returns whether sampling STARTED, which decides whether
   * timings are too perturbed to emit `app_fully_drawn_ms`; arming can fail.
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
   * REJECTS, not `null`, when the native cannot stop: a build that starts but
   * cannot stop would otherwise clear the fallback timer and leave the sampler
   * running all session, reporting success with no trace.
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
