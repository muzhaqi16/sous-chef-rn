/**
 * The single place an armed Hermes startup profile is written and stopped.
 *
 * Termination used to hang off `markFullyDrawn()`, which is reachable only from
 * `useFlashListPerformance`'s `onLoad` — and that hook has three consumers
 * against the 70-odd files that render a FlashList. A profiled launch that
 * landed signed out, or on any screen whose list is not instrumented, left the
 * sampler running for the whole session: every later measurement perturbed, no
 * trace written, and `console` stripped in release so nothing said so.
 *
 * So capture is latched here rather than at any one call site, and armed with
 * fallbacks that do not depend on the launch reaching a particular screen.
 */
import { StartupMark } from '#/native/StartupMark';
import { logger } from '#/utils/environment';

import {
  isStartupProfilerArmed,
  STARTUP_WINDOW_MS,
  FALLBACK_PROFILE_FILENAME,
  VIEW_MANAGER_REPORT_FILENAME,
} from './startupProfiling';
import {
  didViewManagerProbeAttach,
  summarizeViewManagerConstants,
} from './viewManagerProbe';

/**
 * How long a profiled launch may run before the profile is written anyway.
 *
 * The same bound the metric uses (`STARTUP_WINDOW_MS`), so the two halves of
 * this feature agree on where startup ends: past it, the metric emits nothing
 * and the sampler stops. The fallback filename says which window the trace
 * actually covers.
 */
const FALLBACK_CAPTURE_MS = STARTUP_WINDOW_MS;

let captured = false;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Stop sampling and write the trace. Safe to call from anywhere, any number of
 * times: the first call wins and the rest are no-ops.
 */
export function captureStartupProfile(filename: string): void {
  if (captured || !isStartupProfilerArmed()) return;
  captured = true;

  if (fallbackTimer !== null) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }

  // Written whenever the probe ATTACHED, not only when it recorded rows.
  // "Attached and saw nothing" and "never attached" are different answers and
  // the report is where that distinction is legible — gating on records made
  // the second one unreportable.
  if (didViewManagerProbeAttach()) {
    StartupMark.writeTextFile(
      VIEW_MANAGER_REPORT_FILENAME,
      summarizeViewManagerConstants(),
    ).catch(() => {});
  }

  StartupMark.stopProfiling(filename)
    .then(path => {
      logger.info('Hermes startup profile written', { path, filename });
    })
    .catch((error: unknown) => {
      logger.warn('Failed to write Hermes startup profile', {
        error,
        filename,
      });
    });
}

/**
 * Arm the time-based fallback. Called once, from the module that arms the
 * profiler itself, so the two have the same lifetime.
 *
 * Uses `setTimeout` rather than anything imported: this runs as the second
 * module of the bundle, where pulling in React Native would reorder evaluation
 * ahead of the startup origin.
 */
export function armStartupProfileFallback(): void {
  if (!isStartupProfilerArmed() || fallbackTimer !== null) return;
  fallbackTimer = setTimeout(() => {
    fallbackTimer = null;
    logger.warn(
      'Startup profile stopped by fallback: no instrumented list reported ' +
        'first meaningful paint within the capture window',
    );
    captureStartupProfile(FALLBACK_PROFILE_FILENAME);
    // The OS-side marker is owed either way — Android's fully-drawn vital is
    // reported by the platform, not measured by us.
    StartupMark.reportFullyDrawn();
  }, FALLBACK_CAPTURE_MS);
}

/**
 * Stop sampling because the app is leaving the foreground.
 *
 * A launch the user backgrounds before content appears never reaches first
 * meaningful paint, and the samples taken after that point describe a
 * suspended app.
 */
export function captureStartupProfileOnBackground(): void {
  captureStartupProfile(FALLBACK_PROFILE_FILENAME);
}

/** Test seam — the latch and timer are module state. */
export function resetStartupProfileCaptureForTesting(): void {
  captured = false;
  if (fallbackTimer !== null) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
}
