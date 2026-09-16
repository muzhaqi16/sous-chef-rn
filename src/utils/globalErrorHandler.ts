/**
 * Global error handler for unhandled JS exceptions.
 *
 * Call setupGlobalErrorHandler() early in app initialization (before component render)
 * so that crashes are reported to Telemetry / Loki.
 */

import { Telemetry } from '#/services/telemetry';
import { logger } from '#/utils/environment';

/** Reports unhandled JS exceptions, then forwards to RN's own handler. */
export function setupGlobalErrorHandler(): void {
  // --- Unhandled JS exceptions ---
  const previousHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    Telemetry.trackError(error, {
      source: 'global_handler',
      is_fatal: !!isFatal,
    });

    Telemetry.increment('app_unhandled_exceptions_total', 1, {
      fatal: String(!!isFatal),
    });

    if (__DEV__) {
      logger.error('[GlobalErrorHandler] Unhandled exception:', error);
    }

    // Forward to the previous handler so React Native's LogBox / red screen still works
    previousHandler(error, isFatal);
  });

  // Promise rejections are not handled here: nothing in RN or Hermes dispatches
  // `global.onunhandledrejection`. `TelemetryService` installs Hermes' tracker.
}
