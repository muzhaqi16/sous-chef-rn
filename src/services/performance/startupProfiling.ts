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

/**
 * How long after JS entry a launch may still be described as "startup".
 *
 * Both halves of the feature read this one number: the metric refuses to emit
 * an interval longer than it, and the profiler stops sampling at it.
 *
 * WHY IT HAS TO EXIST: the terminating event for `app_fully_drawn_ms` is the
 * first instrumented list reporting real content, and `HomeTabs` is lazy — at
 * cold start only the Pantry tab mounts, so `SortableShoppingList` and
 * `ItemList` can only ever latch after the user navigates. A launch into a
 * detail screen, or an offline pantry stuck on skeletons, therefore leaves the
 * latch open; opening the shopping list twenty seconds later wrote ~20,000 ms
 * into the same unlabelled series as genuine ~2,000 ms launches — the exact
 * distribution poisoning the interactive-gate suppression exists to prevent,
 * arriving through a different door.
 *
 * WHY 10 s: the worst cold start actually recorded on hardware is ~2.2 s on an
 * SM-S908U1, so this is over four times the observed worst case
 * — wide enough that slower hardware is still measured, narrow enough that a
 * navigation cannot pass for a launch. It is NOT defended by argument: an
 * out-of-bound launch increments `startup_window_exceeded_total`, and a
 * non-trivial rate there is the evidence for changing this number.
 *
 * Deliberately NOT shared with any other timeout. The previous 20 s here was
 * the profiler's own fallback, which bounds a sampler's lifetime — a different
 * job, and a value that admits the failure above.
 */
export const STARTUP_WINDOW_MS = 10_000;

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
