import { NativeModules, Platform } from 'react-native';

/**
 * Resolved per call, never captured at module scope.
 *
 * `index.js` imports this module in its first few lines — the earliest point in
 * the bundle. A destructured `const { StartupMarkModule } = NativeModules` there
 * caches whatever the registry held at that instant, and an `undefined` captured
 * then is frozen in for the whole process: every method silently becomes a
 * no-op, including the one that reports fully-drawn to the OS.
 *
 * Deliberately NOT gated on `Platform.OS` — iOS ships the profiling half of this
 * module (`ios/SousChef/StartupMarkModule.mm`). Each method gates on its own
 * existence instead, per the note below.
 */
const nativeModule = (): {
  reportFullyDrawn?: () => void;
  startProfiling?: () => boolean;
  stopProfiling?: (filename: string) => Promise<string>;
  writeTextFile?: (filename: string, contents: string) => Promise<string>;
} | null => NativeModules.StartupMarkModule ?? null;

/**
 * Tells the PLATFORM that the app is fully drawn.
 *
 * Distinct from our own `app_fully_drawn_ms` telemetry, which
 * `NativePerformanceService.markFullyDrawn()` emits alongside this. That metric
 * is ours; this call is what makes the same moment visible to the OS's own
 * tooling.
 *
 * Android: `Activity.reportFullyDrawn()`. It feeds Play Console / Android
 * vitals' "fully drawn" timing, and it is what Macrobenchmark's
 * `timeToFullDisplayMs` reads — so wiring it now is what makes that benchmark
 * meaningful later rather than measuring only the first frame.
 *
 * iOS: nothing, deliberately, and the native module has no such method to call.
 * There is no API that accepts an app-declared "fully drawn" signal; Apple's
 * substitute is an `os_signpost` interval read back by `XCTOSSignpostMetric`,
 * which is only worth emitting once an XCUITest target exists to consume it —
 * the project has no test target at all today, so a signpost would be dead
 * code. iOS still gets `app_fully_drawn_ms`, which is the number we actually
 * compare across builds.
 *
 * The profiling methods below are the ones that ARE on both platforms, so they
 * gate on the method existing rather than on `Platform.OS`. That is what keeps
 * a build with the native module absent — someone on an older binary, or a
 * platform that has not been wired yet — degrading to a no-op instead of
 * throwing, without this file having to track which platforms are done.
 */
export const StartupMark = {
  reportFullyDrawn() {
    if (Platform.OS === 'android') {
      nativeModule()?.reportFullyDrawn?.();
    }
  },

  /**
   * Start Hermes' sampling profiler (release builds included, both platforms).
   *
   * Startup is the one window the dev menu cannot reach — it is over before the
   * menu can be opened — so the profiler has to be armed from `index.js` and
   * stopped at the same instant the fully-drawn marker fires. That makes the
   * profile's window exactly [app_fully_drawn_ms]'s window, by construction.
   *
   * Returns whether sampling actually STARTED, which is what decides whether
   * this run's timings are perturbed enough to withhold `app_fully_drawn_ms`.
   * Both natives report that as a boolean; a method that merely EXISTS proves
   * nothing, because the profiler can fail to arm on a non-Hermes variant or
   * one missing the profiler library, and a run that claims armed without
   * arming loses the metric and gets no trace in exchange.
   *
   * A native that predates this contract returns undefined rather than a
   * boolean, which is coerced to false — the safe direction: the metric is
   * emitted and the trace is simply absent.
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
   * Stop profiling and write the trace; resolves with its absolute path.
   *
   * REJECTS when the native cannot stop, rather than resolving `null`. A build
   * that can `startProfiling` but not `stopProfiling` — an older native, or a
   * platform not yet wired — is the worst case there is: sampling has already
   * started, so resolving success cleared the fallback timer, logged "profile
   * written" with a null path, and left the sampler running for the rest of the
   * session. Every later measurement perturbed, `isStartupProfilerArmed()` true
   * so `app_fully_drawn_ms` stayed suppressed, no trace produced, and the only
   * diagnostic said it had worked. A rejection reaches the existing `.catch`
   * and says so.
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
