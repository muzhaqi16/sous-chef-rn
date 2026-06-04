import { useStore } from '#store';
import { queueManager } from '../offlineQueue/queueManager';
import { logger } from '#/utils/environment';

/**
 * Circuit breaker over GraphQL network outcomes — the single source of truth for
 * "is our API reachable right now," distinct from device internet (`isOnline`).
 *
 * The device can be online while the API is down / timing out / behind a captive
 * portal. Without this, every query independently fires, retries 3×, and fails
 * while the API is down. The breaker collapses that into one signal
 * (`store.apiReachable`) so `offlineModeLink` serves queries from cache and
 * `queueLink` queues mutations — exactly as if the device were offline.
 *
 * States:
 *  - closed:    normal. After N consecutive per-operation failures → open.
 *  - open:      `apiReachable = false`. Queries served from cache, mutations
 *               queued. After a delay → half-open.
 *  - half-open: `apiReachable = true` so normal traffic re-probes. One success →
 *               closed (drain the queue); one failure → open again.
 *
 * Fed by `networkStatusLink` (one outcome per operation, above retryLink) and
 * reset on every connectivity transition by `useOnlineQueueSync`.
 */

/** Consecutive per-operation failures (in the closed state) before opening. */
const FAILURE_THRESHOLD = 3;
/** How long to stay open before letting traffic re-probe (half-open). */
const HALF_OPEN_DELAY_MS = 20_000;

type CircuitState = 'closed' | 'open' | 'half-open';

class ApiReachabilityBreaker {
  private circuitState: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private halfOpenTimer: ReturnType<typeof setTimeout> | null = null;

  /** A real network response arrived — the API is reachable. */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.clearTimer();
    if (this.circuitState !== 'closed') {
      this.circuitState = 'closed';
      useStore.getState().setApiReachable(true);
      logger.info('🔌 API reachable — circuit closed, draining queue');
      queueManager.requestDrain();
    }
  }

  /** A network request failed (or a mutation had to be queued). */
  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.circuitState === 'half-open') {
      // Probe failed → re-open immediately.
      this.open();
      return;
    }
    if (
      this.circuitState === 'closed' &&
      this.consecutiveFailures >= FAILURE_THRESHOLD
    ) {
      this.open();
    }
  }

  /**
   * Fresh, optimistic start. Called on every device connectivity transition so a
   * reconnect doesn't carry a stale open circuit (which would keep serving cache
   * for up to the half-open delay after the network is actually back).
   */
  reset(): void {
    this.consecutiveFailures = 0;
    this.clearTimer();
    this.circuitState = 'closed';
    useStore.getState().setApiReachable(true);
  }

  /** @internal test-only — current circuit state. */
  _getState(): CircuitState {
    return this.circuitState;
  }

  private open(): void {
    this.circuitState = 'open';
    useStore.getState().setApiReachable(false);
    logger.warn('🔌 API unreachable — circuit open (serving cache, queueing)');
    this.clearTimer();
    this.halfOpenTimer = setTimeout(() => {
      this.halfOpenTimer = null;
      this.circuitState = 'half-open';
      // Let traffic through to re-probe; a success closes it, a failure re-opens.
      useStore.getState().setApiReachable(true);
      logger.info('🔌 API circuit half-open — probing');
    }, HALF_OPEN_DELAY_MS);
  }

  private clearTimer(): void {
    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
      this.halfOpenTimer = null;
    }
  }
}

export const apiReachabilityBreaker = new ApiReachabilityBreaker();
