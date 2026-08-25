import { env as buildEnv } from '#/config/env';

/**
 * Whether this build should record a Hermes CPU profile of startup.
 *
 * Build-time and off by default. Sampling costs time, so a profiled run's
 * `app_fully_drawn_ms` is NOT comparable with an unprofiled one's — which is
 * why `markFullyDrawn()` skips the histogram entirely while this is on, rather
 * than quietly poisoning the baseline series the metric exists to provide.
 *
 * Lives in its own module so `index.js` (which arms the profiler) and
 * `NativePerformanceService` (which stops it) can both read it without
 * importing each other.
 */
export const HERMES_PROFILE_STARTUP =
  buildEnv.HERMES_PROFILE_STARTUP === 'true';

/**
 * Whether the profiler ACTUALLY armed on this run — not merely whether the
 * build asked for it.
 *
 * The flag above is platform-agnostic build config, and so is the profiler:
 * BOTH natives export `startProfiling`. What varies is whether sampling
 * actually starts — a non-Hermes variant, or one where the profiler library was
 * not merged in, arms nothing. Suppressing the histogram on the build flag
 * would therefore withhold the metric from runs that were never perturbed and
 * produced no trace either. Suppression keys off this instead, which each
 * native reports directly.
 */
let profilerArmed = false;

/** Called from `armStartupProfiling` with the result of arming the profiler. */
export function setStartupProfilerArmed(armed: boolean): void {
  profilerArmed = armed;
}

/** True only when this run's timings are actually perturbed by sampling. */
export function isStartupProfilerArmed(): boolean {
  return profilerArmed;
}

/** Trace filename; `adb pull`-able from the app's external files dir. */
export const STARTUP_PROFILE_FILENAME = 'startup.cpuprofile';

/**
 * Trace filename used when capture was forced rather than triggered by first
 * meaningful paint — a launch that backgrounded early, or one that never
 * rendered an instrumented list within the capture window.
 *
 * Named apart from `STARTUP_PROFILE_FILENAME` on purpose: this trace does NOT
 * cover the same window as `app_fully_drawn_ms`, and reading it as if it did
 * would attribute an arbitrary tail of the session to startup.
 */
export const FALLBACK_PROFILE_FILENAME = 'startup-fallback.cpuprofile';

/** Companion report naming which view managers were queried, and for how long. */
export const VIEW_MANAGER_REPORT_FILENAME = 'viewmanagers.json';
