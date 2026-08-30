import { env as buildEnv } from '#/config/env';

/**
 * Whether this build should record a Hermes CPU profile of startup. Build-time,
 * off by default. Sampling costs time, so `markFullyDrawn()` skips the histogram
 * entirely while this is on rather than poisoning the baseline series.
 */
export const HERMES_PROFILE_STARTUP =
  buildEnv.HERMES_PROFILE_STARTUP === 'true';

/**
 * Whether the profiler ACTUALLY armed on this run. Both natives export
 * `startProfiling`, but a non-Hermes variant arms nothing — suppressing the
 * histogram on the build flag alone would withhold the metric from runs that
 * were never perturbed and produced no trace either.
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

/**
 * The bound on "startup": the metric emits nothing past it and the profiler
 * stops sampling. `HomeTabs` is lazy, so the `app_fully_drawn_ms` latch can stay
 * open across a navigation — unbounded it wrote ~20,000 ms rows into the same
 * series as real launches. Evidence for a change: `startup_window_exceeded_total`.
 */
export const STARTUP_WINDOW_MS = 10_000;

/** Trace filename; `adb pull`-able from the app's external files dir. */
export const STARTUP_PROFILE_FILENAME = 'startup.cpuprofile';

/**
 * Trace filename for a forced capture — a launch that backgrounded early or
 * never rendered an instrumented list. Named apart from
 * `STARTUP_PROFILE_FILENAME` because it does NOT cover the `app_fully_drawn_ms`
 * window, and reading it as if it did misattributes an arbitrary tail.
 */
export const FALLBACK_PROFILE_FILENAME = 'startup-fallback.cpuprofile';

/** Companion report naming which view managers were queried, and for how long. */
export const VIEW_MANAGER_REPORT_FILENAME = 'viewmanagers.json';
