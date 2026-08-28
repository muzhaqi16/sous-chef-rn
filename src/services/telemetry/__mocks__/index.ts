/**
 * Shared test mock for the `Telemetry` facade.
 *
 * Applied globally via `jest.setup.js` (`jest.mock('#/services/telemetry')`).
 *
 * Without it the real facade runs under jest: `Environment` is auto-mocked to
 * development mode, so `enabled`/`enableMetrics` are true, and
 * `env.generated.ts` supplies real OTLP endpoints — which makes
 * `transports.http` true and wires up `HttpTransport`. Jest has no `fetch`
 * mock, so every `Telemetry.error(...)` a test triggers flushes immediately
 * (error-level logs bypass the interval) and POSTs the batch to the real
 * Loki/Mimir hosts. Test fixture strings like `'boom'` and `'Display failed'`
 * end up in production observability, drowning out real user errors.
 *
 * Conventions for tests that touch `Telemetry`:
 *
 *   ✅ DO — assert on the shared spies directly:
 *     ```ts
 *     import { Telemetry } from '#/services/telemetry';
 *     expect(Telemetry.increment).toHaveBeenCalledWith('pantry_errors_total');
 *     ```
 *
 *   ✅ DO — opt out when testing the telemetry internals themselves. The
 *      `TelemetryService` / `HttpTransport` suites already import those
 *      classes directly rather than through this facade, so they are
 *      unaffected.
 *
 *   ❌ DON'T — write a per-suite partial factory:
 *     ```ts
 *     jest.mock('#/services/telemetry', () => ({
 *       Telemetry: { error: jest.fn() },  // missing every other method
 *     }));
 *     ```
 *      It shadows this mock and reintroduces the "Telemetry.X is not a
 *      function" fragility whenever a code path reaches for a method the
 *      factory forgot.
 */

export const Telemetry = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  // Defaults to true so a guarded breadcrumb still reaches `Telemetry.debug`
  // under test — a suite asserting on the guarded call would otherwise pass
  // vacuously. Override per-test to exercise the suppressed path.
  isLevelEnabled: jest.fn().mockReturnValue(true),
  increment: jest.fn(),
  gauge: jest.fn(),
  histogram: jest.fn(),
  trackEvent: jest.fn(),
  trackScreen: jest.fn(),
  trackError: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
  updateConfig: jest.fn(),
  initialize: jest.fn(),
};
