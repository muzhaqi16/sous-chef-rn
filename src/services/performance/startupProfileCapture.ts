/**
 * The single place an armed Hermes startup profile is written and stopped, with
 * fallbacks that do not depend on reaching a particular screen — a launch
 * landing signed out would otherwise leave the sampler running all session,
 * perturbing every later measurement, silently in release.
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
 * The same bound the metric uses, so both halves agree on where startup ends.
 * The fallback filename says which window the trace actually covers.
 */
const FALLBACK_CAPTURE_MS = STARTUP_WINDOW_MS;

let captured = false;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

/** Stop sampling and write the trace; the first call wins, the rest no-op. */
export function captureStartupProfile(filename: string): void {
  if (captured || !isStartupProfilerArmed()) return;
  captured = true;

  if (fallbackTimer !== null) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }

  // Written whenever the probe ATTACHED, not only when it recorded rows —
  // "attached and saw nothing" and "never attached" are different answers.
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
 * Armed from the module that arms the profiler, so the two share a lifetime.
 * `setTimeout` rather than an import: this runs as the second module of the
 * bundle, where pulling in React Native would reorder the startup origin.
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
    // Owed either way: Android's fully-drawn vital is reported by the platform.
    StartupMark.reportFullyDrawn();
  }, FALLBACK_CAPTURE_MS);
}

/**
 * A launch backgrounded before content appears never reaches first meaningful
 * paint, and samples past that point describe a suspended app.
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
