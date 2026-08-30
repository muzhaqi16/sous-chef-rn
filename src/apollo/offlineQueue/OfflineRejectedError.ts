/**
 * `queueLink` fast-failing an online-only mutation while offline. Real and
 * user-surfaced — the message stays network-shaped so the hook toasts honestly
 * — but it never touched the wire, so `networkStatusLink`'s breaker and
 * `telemetryLink`'s counter must NOT count it as evidence the API is down.
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
 * Also matches on `name`, tolerating a transform that breaks `instanceof`
 * across a module boundary.
 */
export function isOfflineRejectedError(error: unknown): boolean {
  return (
    error instanceof OfflineRejectedError ||
    (error as { name?: string } | null)?.name === 'OfflineRejectedError'
  );
}
