export interface BackoffSchedule {
  baseMs: number;
  /** Growth per attempt; 2 doubles. */
  factor?: number;
  /**
   * Applied before jitter: capping the sum would put every client past the
   * cap on the same tick.
   */
  maxMs?: number;
  /** Adds up to this fraction of the delay at random: 0.25 is up to 25%. */
  jitter?: number;
  random?: () => number;
}

/** The wait before retry `attempt`, counted from 0: `baseMs × factor^attempt`. */
export function backoffDelay(
  attempt: number,
  {
    baseMs,
    factor = 2,
    maxMs = Infinity,
    jitter = 0,
    random = Math.random,
  }: BackoffSchedule,
): number {
  const delay = Math.min(baseMs * factor ** attempt, maxMs);
  return jitter > 0 ? delay + delay * jitter * random() : delay;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

// Paced for a person, not a machine; index 0 is the never-tried state.
const COOLDOWN_MS = [0, 30_000, 60_000, 180_000, 300_000];

/** How long a person waits after `attempts` tries, holding at the last step. */
export const retryCooldownMs = (attempts: number): number =>
  COOLDOWN_MS[Math.min(Math.max(attempts, 0), COOLDOWN_MS.length - 1)] ?? 0;
