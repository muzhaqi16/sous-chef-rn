import { AppState } from 'react-native';
import { useStore } from '#store';
import { queueManager } from '../offlineQueue/queueManager';
import { probeApiHealth } from './apiHealthProbe';
import { logger } from '#/utils/environment';

/**
 * The single source of truth for "is the API reachable", distinct from device
 * internet. Recovery is ACTIVE — it probes `/health`, because `offlineModeLink`
 * blocks the traffic that would prove it. `recordSuccess` writes unconditionally
 * and the flag is never persisted, so a desync self-heals rather than sticking.
 */

/** Consecutive per-operation failures (in the closed state) before opening. */
const FAILURE_THRESHOLD = 3;
/** Delay before the first /health probe after the circuit opens. */
const INITIAL_PROBE_DELAY_MS = 20_000;
/** Probe backoff cap — keeps probing a long-dead API cheap on battery. */
const MAX_PROBE_DELAY_MS = 120_000;

type CircuitState = 'closed' | 'open';

class ApiReachabilityBreaker {
  private circuitState: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private probeTimer: ReturnType<typeof setTimeout> | null = null;
  private probeInFlight = false;
  private probeAttempt = 0;
  /**
   * The failures since the last success, newest last (capped) — dumped when
   * the circuit opens so the log names exactly which operations tripped it
   * instead of leaving the cause to guesswork.
   */
  private recentFailures: string[] = [];

  /**
   * A real network response arrived — the API is reachable.
   * @param source diagnostic label for the log (operation name / '/health probe')
   */
  recordSuccess(source?: string): void {
    this.consecutiveFailures = 0;
    this.probeAttempt = 0;
    this.recentFailures = [];
    this.clearProbeTimer();
    const wasOpen = this.circuitState === 'open';
    this.circuitState = 'closed';
    // Unconditional write — repairs any store/breaker desync (the setter
    // no-ops when the value is unchanged, so this is free in steady state).
    useStore.getState().setApiReachable(true);
    if (wasOpen) {
      logger.info(
        `🔌 API reachable — circuit closed by ${
          source ?? 'a network success'
        }, draining queue`,
      );
      queueManager.requestDrain();
    }
  }

  /**
   * A network request failed (or a mutation was queued on a network error).
   * @param source diagnostic label: which operation failed and why
   */
  recordFailure(source?: string): void {
    // Suspension noise: the OS aborts in-flight requests when the app leaves
    // the foreground. Those failures say nothing about the API.
    if (AppState.currentState !== 'active') {
      logger.debug(
        `🔌 API failure ignored (app not active): ${source ?? 'unknown'}`,
      );
      return;
    }
    this.consecutiveFailures += 1;
    if (this.recentFailures.length >= 5) this.recentFailures.shift();
    this.recentFailures.push(source ?? 'unknown');
    logger.info(
      `🔌 API failure ${this.consecutiveFailures}/${FAILURE_THRESHOLD} — ${
        source ?? 'unknown'
      }`,
    );
    if (this.circuitState !== 'closed') return;
    if (this.consecutiveFailures >= FAILURE_THRESHOLD) {
      // Fallback: enough operations have failed that the API is clearly down,
      // even when the /health probe can't be trusted to arbitrate (e.g. the
      // endpoint is missing in this environment, so the probe never succeeds).
      this.open();
      return;
    }
    // Don't wait for FAILURE_THRESHOLD operations to each burn through
    // retryLink's attempts before opening: confirm with one direct /health
    // probe now. A probe success forgives a transient blip (recordSuccess
    // resets the counter); a probe failure opens the circuit immediately.
    // Guarded by `probeInFlight`, so a burst of concurrent failures collapses
    // to a single probe.
    void this.probe();
  }

  /**
   * Fresh start, optimistic only while a link exists. With no link reachability
   * is UNKNOWN, not proven — asserting `true` there makes `shouldTreatAsOffline`
   * false for a whole offline session, and the probe loop cannot correct it
   * because this also closes the circuit. So `reset()` reads the link itself.
   */
  reset(): void {
    this.consecutiveFailures = 0;
    this.probeAttempt = 0;
    this.recentFailures = [];
    this.clearProbeTimer();
    // Release any in-flight probe slot so a failure right after the transition
    // can fire a fresh arbiter probe immediately. A stale fetch resolving later
    // is dropped by the flag/counter guards in `probe()`.
    this.probeInFlight = false;
    this.circuitState = 'closed';
    useStore
      .getState()
      .setApiReachable(useStore.getState().isOnline ? true : null);
  }

  /**
   * The device link went down; the store has already moved `apiReachable` to
   * `null`. Starts the probe loop, the only thing that can turn it back into a
   * fact — a `/health` success while NetInfo says offline proves NetInfo wrong.
   * The SAME loop the open circuit uses, capped at one probe every two minutes.
   */
  onDeviceOffline(): void {
    this.probeAttempt = 0;
    this.scheduleProbe();
  }

  /**
   * App returned to the foreground. The pre-background failure count is stale
   * signal; if the circuit is open (or the store flag is somehow stuck false),
   * probe NOW instead of waiting out a timer that didn't run while suspended.
   */
  onAppForeground(): void {
    this.consecutiveFailures = 0;
    if (
      this.circuitState === 'open' ||
      useStore.getState().apiReachable === false
    ) {
      logger.info(
        `🔌 app foregrounded while unreachable (circuit ${this.circuitState}) — probing /health now`,
      );
      void this.probe();
    }
  }

  /** @internal test-only — current circuit state. */
  _getState(): CircuitState {
    return this.circuitState;
  }

  private open(): void {
    this.circuitState = 'open';
    this.probeAttempt = 0;
    useStore.getState().setApiReachable(false);
    logger.warn(
      `🔌 API unreachable — circuit open (serving cache, queueing). Tripped by: ${this.recentFailures.join(
        ' | ',
      )}`,
    );
    this.scheduleProbe();
  }

  private scheduleProbe(): void {
    this.clearProbeTimer();
    const delay = Math.min(
      INITIAL_PROBE_DELAY_MS * 2 ** this.probeAttempt,
      MAX_PROBE_DELAY_MS,
    );
    logger.info(`🔌 next /health probe in ${Math.round(delay / 1000)}s`);
    this.probeTimer = setTimeout(() => {
      this.probeTimer = null;
      void this.probe();
    }, delay);
  }

  private async probe(): Promise<void> {
    if (this.probeInFlight) return;
    this.clearProbeTimer();
    this.probeInFlight = true;
    let reachable = false;
    try {
      reachable = await probeApiHealth();
    } finally {
      this.probeInFlight = false;
    }
    if (reachable) {
      this.recordSuccess('/health probe');
      return;
    }
    logger.warn(`🔌 /health probe failed (attempt ${this.probeAttempt + 1})`);
    if (this.circuitState === 'open') {
      this.probeAttempt += 1;
      this.scheduleProbe();
      return;
    }

    if (
      useStore.getState().apiReachable === false ||
      this.consecutiveFailures > 0
    ) {
      // The probe confirmed a failure we already saw while the circuit was
      // still closed — open so the probe loop owns recovery. Two entry points:
      // a stale stuck flag (apiReachable false while closed, e.g. a foreground
      // probe), or the first-failure arbiter probe in recordFailure. The
      // guards also drop stale probe results that resolve after a reset()
      // (which clears the flag and zeroes consecutiveFailures).
      this.open();
      return;
    }

    // Circuit closed, nothing else to act on — but if the device link is down
    // this loop is the ONLY thing running, because no traffic is allowed to
    // produce a failure that would open the circuit. Keep it alive so a
    // recovery gets noticed; opening would be wrong, since a failed probe with
    // no link says nothing about the API.
    if (!useStore.getState().isOnline) {
      this.probeAttempt += 1;
      this.scheduleProbe();
    }
  }

  private clearProbeTimer(): void {
    if (this.probeTimer) {
      clearTimeout(this.probeTimer);
      this.probeTimer = null;
    }
  }
}

export const apiReachabilityBreaker = new ApiReachabilityBreaker();
