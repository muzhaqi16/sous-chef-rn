/**
 * Thrown by `queueLink` when it fast-fails an online-only mutation because the
 * device is offline and the mutation cannot be queued for replay.
 *
 * It IS a real, user-surfaced failure — the message stays network-shaped so the
 * firing hook treats it as an offline failure and shows its honest toast — but
 * the request never touched the network. So the API-reachability circuit breaker
 * (`networkStatusLink`) and the network-error telemetry counter (`telemetryLink`)
 * must NOT count it: doing so feeds the breaker its own preemptive decision with
 * zero evidence the API is actually down. Those links recognize it by identity
 * via {@link isOfflineRejectedError}.
 */
export class OfflineRejectedError extends Error {
  constructor(operationName?: string | null) {
    super(
      `Network unavailable: device is offline and ${
        operationName ?? 'this mutation'
      } cannot be queued for replay`,
    );
    this.name = 'OfflineRejectedError';
  }
}

/**
 * Identity check for {@link OfflineRejectedError}. Tolerates the rare case where
 * a transform breaks `instanceof` across a module boundary by also matching the
 * error `name`.
 */
export function isOfflineRejectedError(error: unknown): boolean {
  return (
    error instanceof OfflineRejectedError ||
    (error as { name?: string } | null)?.name === 'OfflineRejectedError'
  );
}
