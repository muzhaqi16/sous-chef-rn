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
 * iOS: nothing, deliberately. There is no API that accepts an app-declared
 * "fully drawn" signal; Apple's substitute is an `os_signpost` interval read
 * back by `XCTOSSignpostMetric`, which is only worth emitting once an XCUITest
 * target exists to consume it — the project has no test target at all today, so
 * a signpost would be dead code. iOS still gets `app_fully_drawn_ms`, which is
 * the number we actually compare across builds.
 */
export const StartupMark = {
  reportFullyDrawn() {
    if (Platform.OS === 'android' && StartupMarkModule) {
      StartupMarkModule.reportFullyDrawn();
    }
  },
};
