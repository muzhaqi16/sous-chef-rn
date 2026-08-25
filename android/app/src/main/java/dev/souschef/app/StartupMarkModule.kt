package dev.souschef.app

import com.facebook.hermes.instrumentation.HermesSamplingProfiler
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import java.io.File

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

  /**
   * Start Hermes' sampling profiler.
   *
   * Available in RELEASE builds, which is the whole point: this project has
   * already proved that debug-build attribution is positional — the first heavy
   * `require` after a timing mark absorbs ~200 ms belonging to no module — and
   * withdrew a cost table over it. `libjsijniprofiler` is not its own `.so`;
   * CMake merges it into `libhermestooling.so`, which ships in the release APK,
   * and SoLoader resolves it through `@SoLoaderLibrary("jsijniprofiler")`.
   */
  @ReactMethod
  fun startProfiling() {
    HermesSamplingProfiler.enable()
  }

  /**
   * Stop profiling and write the trace, resolving with its absolute path.
   *
   * Dump BEFORE disable — that is the order React Native itself uses
   * (`HermesExecutorFactory.stopSamplingProfiler`); disabling first discards
   * the samples.
   *
   * Writes to the app's EXTERNAL files dir, not `cacheDir`, so `adb pull` can
   * fetch it. A `localRelease` build is not debuggable, so `adb shell run-as`
   * cannot reach internal storage — a trace we cannot retrieve is useless.
   */
  @ReactMethod
  fun stopProfiling(filename: String, promise: Promise) {
    val dir = reactApplicationContext.getExternalFilesDir(null)
    if (dir == null) {
      promise.reject("no_external_dir", "External files dir unavailable")
      return
    }
    val file = File(dir, filename)
    HermesSamplingProfiler.dumpSampledTraceToFile(file.absolutePath)
    HermesSamplingProfiler.disable()
    promise.resolve(file.absolutePath)
  }

  /**
   * Write a text file beside the profile, in the app's external files dir.
   *
   * Needed because a release build strips `console`, so a measurement that only
   * logged its result would produce nothing retrievable.
   */
  @ReactMethod
  fun writeTextFile(filename: String, contents: String, promise: Promise) {
    val dir = reactApplicationContext.getExternalFilesDir(null)
    if (dir == null) {
      promise.reject("no_external_dir", "External files dir unavailable")
      return
    }
    val file = File(dir, filename)
    file.writeText(contents)
    promise.resolve(file.absolutePath)
  }

  companion object {
    const val NAME = "StartupMarkModule"
  }
}
