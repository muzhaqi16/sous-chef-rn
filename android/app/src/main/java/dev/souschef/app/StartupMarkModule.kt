package dev.souschef.app

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Reports "the app is fully drawn" to Android itself.
 *
 * `Activity.reportFullyDrawn()` is how an app tells the platform that its
 * content is genuinely on screen, as opposed to the first frame the system can
 * already see. It feeds Play Console / Android vitals' fully-drawn timing, and
 * it is the signal Macrobenchmark's `timeToFullDisplayMs` reads — so this is
 * what makes a startup benchmark measure the moment users care about rather
 * than the moment the window appears.
 *
 * The JS side decides when: the first list to finish loading in a session
 * (see `NativePerformanceService.markFullyDrawn`), which also emits our own
 * `app_fully_drawn_ms` for the same moment.
 */
class StartupMarkModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun reportFullyDrawn() {
    // `reportFullyDrawn` must be called on the main thread, and the Activity
    // can be gone by now (backgrounded, or rotated mid-load) — a null check is
    // the whole error handling this needs, since a missed report costs a
    // metric rather than correctness.
    UiThreadUtil.runOnUiThread {
      // `reactApplicationContext.currentActivity`, not the module's own
      // `getCurrentActivity()` — the latter is deprecated in RN 0.80+.
      reactApplicationContext.currentActivity?.reportFullyDrawn()
    }
  }

  companion object {
    const val NAME = "StartupMarkModule"
  }
}
