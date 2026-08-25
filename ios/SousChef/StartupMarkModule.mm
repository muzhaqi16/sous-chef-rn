#import <React/RCTBridgeModule.h>
#import <Foundation/Foundation.h>

#import <hermes/hermes.h>
#import <jsi/jsi.h>

#include <string>

/**
 * iOS half of the startup-measurement bridge — the counterpart to Android's
 * `StartupMarkModule.kt`, exposing the same three profiling methods so
 * `src/native/StartupMark.ts` can call either without branching on platform.
 *
 * Android's fourth method, `reportFullyDrawn`, has no counterpart here on
 * purpose. `Activity.reportFullyDrawn()` feeds Play Console vitals and
 * Macrobenchmark's `timeToFullDisplayMs`; iOS has no API that accepts an
 * app-declared "fully drawn" signal at all. Apple's substitute is an
 * `os_signpost` interval read back by `XCTOSSignpostMetric`, which only pays
 * for itself once an XCUITest target exists to consume it, and this project has
 * no test target — so an implementation here would be unreachable code. iOS
 * still gets `app_fully_drawn_ms`, which is the number actually compared across
 * builds; what is missing is the OS-side cross-check, not the measurement.
 */
@interface StartupMarkModule : NSObject <RCTBridgeModule>
@end

@implementation StartupMarkModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

/**
 * Hermes' process-global root API.
 *
 * The sampling profiler is reachable on iOS without any extra dependency —
 * `react-native-release-profiler` was NOT adopted, for the same reason it was
 * skipped on Android. Three things make the built-in route viable in a RELEASE
 * build, each verified against the installed pod rather than assumed:
 *
 *   - `makeHermesRootAPI()` is an exported symbol in the shipped
 *     `hermesvm.xcframework` (checked with `nm -gU` on both the
 *     `ios-arm64_x86_64-simulator` and `ios-arm64` slices).
 *   - The profiler is genuinely compiled in, not stubbed out by
 *     `HERMESVM_SAMPLING_PROFILER_AVAILABLE`: `SamplingProfiler.cpp.o`,
 *     `SamplingProfilerPosix.cpp.o` and `SamplingProfilerSampler.cpp.o` are all
 *     linked into that binary.
 *   - `Pods-SousChef.*.xcconfig` already carries
 *     `$(PODS_ROOT)/Headers/Public/hermes-engine` on HEADER_SEARCH_PATHS and the
 *     xcframework directory on FRAMEWORK_SEARCH_PATHS, so no Podfile change is
 *     needed.
 *
 * The profiler methods are `virtual` on `IHermesRootAPI`, so they dispatch
 * through this object's vtable and need no exported symbols of their own. The
 * returned object has static lifetime, so caching it is safe.
 */
static facebook::hermes::IHermesRootAPI *HermesRootAPI(void)
{
  static facebook::hermes::IHermesRootAPI *api =
      facebook::jsi::castInterface<facebook::hermes::IHermesRootAPI>(
          facebook::hermes::makeHermesRootAPI());
  return api;
}

/**
 * Where a profile or report is written.
 *
 * The app's Documents directory, which `xcrun simctl get_app_container booted
 * dev.souschef.app data` can reach on a simulator and which the Files app / a
 * container download can reach on a device. This is the iOS answer to the same
 * problem Android solved with the external files dir: a release build is not
 * debuggable, and a trace that cannot be retrieved is useless.
 */
static NSString *DocumentsPathFor(NSString *filename)
{
  NSString *dir = NSSearchPathForDirectoriesInDomains(
      NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
  return dir ? [dir stringByAppendingPathComponent:filename] : nil;
}

/**
 * Start Hermes' sampling profiler.
 *
 * Release builds included, which is the whole point: this project has already
 * proved that debug-build attribution is positional — the first heavy `require`
 * after a timing mark absorbs ~200 ms belonging to no module — and withdrew a
 * cost table over it.
 *
 * Startup is the one window a dev menu cannot reach, since it is over before
 * the menu can be opened, so this is armed from `index.js` and stopped at the
 * instant the fully-drawn marker fires.
 */
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(startProfiling)
{
  // Returns whether sampling ACTUALLY started, because JS keys the
  // `app_fully_drawn_ms` suppression off that answer. A fire-and-forget method
  // that silently early-returned still looked like success from JS, which cost
  // a build both the metric and the trace it was withheld for.
  auto *api = HermesRootAPI();
  if (api == nullptr) {
    return @NO;
  }
  @try {
    api->enableSamplingProfiler();
  } @catch (NSException *exception) {
    return @NO;
  }
  return @YES;
}

/**
 * Stop profiling and write the trace, resolving with its absolute path.
 *
 * Dump BEFORE disable. That is the order React Native itself uses
 * (`HermesExecutorFactory::stopSamplingProfiler`), and disabling first discards
 * the samples — the failure is silent and produces a valid-looking empty trace,
 * so it is worth stating rather than leaving to call-order luck.
 */
RCT_EXPORT_METHOD(stopProfiling
                  : (NSString *)filename resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)
{
  auto *api = HermesRootAPI();
  if (api == nullptr) {
    reject(@"no_hermes_root_api",
           @"Hermes root API unavailable — is this a Hermes build?", nil);
    return;
  }

  NSString *path = DocumentsPathFor(filename);
  if (path == nil) {
    reject(@"no_documents_dir", @"Documents directory unavailable", nil);
    return;
  }

  // Guarded, and the profiler disabled regardless of whether the dump worked.
  // An uncaught throw here would terminate the process AND leave sampling on,
  // perturbing every later measurement in the session — the Kotlin side wraps
  // the same recovery in `runCatching`.
  @try {
    api->dumpSampledTraceToFile(std::string(path.UTF8String));
  } @catch (NSException *exception) {
    @try {
      api->disableSamplingProfiler();
    } @catch (NSException *ignored) {
    }
    reject(@"profile_write_failed", exception.reason ?: @"dump failed", nil);
    return;
  }

  @try {
    api->disableSamplingProfiler();
  } @catch (NSException *ignored) {
  }
  resolve(path);
}

/**
 * Write a text file beside the profile.
 *
 * Needed because a release build strips `console` (babel.config.js applies
 * `transform-remove-console` under BABEL_ENV=production, keeping only
 * error/warn), so a measurement that merely logged its result would produce
 * nothing retrievable.
 */
RCT_EXPORT_METHOD(writeTextFile
                  : (NSString *)filename contents
                  : (NSString *)contents resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)
{
  NSString *path = DocumentsPathFor(filename);
  if (path == nil) {
    reject(@"no_documents_dir", @"Documents directory unavailable", nil);
    return;
  }

  NSError *error = nil;
  [contents writeToFile:path
             atomically:YES
               encoding:NSUTF8StringEncoding
                  error:&error];
  if (error != nil) {
    reject(@"write_failed", error.localizedDescription, error);
    return;
  }
  resolve(path);
}

@end
