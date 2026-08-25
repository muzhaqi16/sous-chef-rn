import { NativeModules, Platform } from 'react-native';

const { StartupMarkModule } = NativeModules;

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
    if (Platform.OS === 'android' && StartupMarkModule) {
      StartupMarkModule.reportFullyDrawn();
    }
  },

  /**
   * Start Hermes' sampling profiler (release builds included, both platforms).
   *
   * Startup is the one window the dev menu cannot reach — it is over before the
   * menu can be opened — so the profiler has to be armed from `index.js` and
   * stopped at the same instant the fully-drawn marker fires. That makes the
   * profile's window exactly [app_fully_drawn_ms]'s window, by construction.
   */
  startProfiling() {
    if (StartupMarkModule?.startProfiling) {
      StartupMarkModule.startProfiling();
    }
  },

  /** Write a text file beside the profile (release strips `console`). */
  writeTextFile(filename: string, contents: string): Promise<string | null> {
    if (StartupMarkModule?.writeTextFile) {
      return StartupMarkModule.writeTextFile(filename, contents);
    }
    return Promise.resolve(null);
  },

  /** Stop profiling and write the trace; resolves with its absolute path. */
  stopProfiling(filename: string): Promise<string | null> {
    if (StartupMarkModule?.stopProfiling) {
      return StartupMarkModule.stopProfiling(filename);
    }
    return Promise.resolve(null);
  },
};
