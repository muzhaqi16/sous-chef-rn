/**
 * Global error handler for unhandled JS exceptions and promise rejections.
 *
 * Call setupGlobalErrorHandler() early in app initialization (before component render)
 * so that crashes and unhandled rejections are reported to Telemetry / Loki.
 */

import { Telemetry } from '#/services/telemetry';

/**
 * Install global handlers for:
 * 1. Unhandled JS exceptions (via React Native's ErrorUtils)
 * 2. Unhandled promise rejections
 */
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
      console.error('[GlobalErrorHandler] Unhandled exception:', error);
    }

    // Forward to the previous handler so React Native's LogBox / red screen still works
    previousHandler?.(error, isFatal);
  });

  // --- Unhandled promise rejections ---
  // React Native surfaces these via the global `unhandledrejection` event
  // or the `tracking-` polyfill. We use the event-based approach.
  if (typeof global !== 'undefined') {
    const g = global as typeof globalThis & {
      onunhandledrejection?: ((event: { reason: unknown }) => void) | null;
    };

    // Some RN versions expose onunhandledrejection
    const existingHandler = g.onunhandledrejection;

    g.onunhandledrejection = (event: { reason: unknown }) => {
      const reason = event?.reason;
      const message =
        reason instanceof Error ? reason.message : String(reason ?? 'Unknown');

      Telemetry.trackError(message, {
        source: 'global_handler',
        type: 'unhandled_promise_rejection',
      });

      Telemetry.increment('unhandled_promise_rejections_total', 1);

      if (__DEV__) {
        console.error(
          '[GlobalErrorHandler] Unhandled promise rejection:',
          reason,
        );
      }

      // Forward to any existing handler
      existingHandler?.(event);
    };
  }
}
