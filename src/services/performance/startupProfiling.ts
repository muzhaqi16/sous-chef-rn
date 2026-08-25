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

/** Trace filename; `adb pull`-able from the app's external files dir. */
export const STARTUP_PROFILE_FILENAME = 'startup.cpuprofile';

/** Companion report naming which view managers were queried, and for how long. */
export const VIEW_MANAGER_REPORT_FILENAME = 'viewmanagers.json';
