import { useEffect, useState } from 'react';

/**
 * Exponential backoff delays in seconds between resend attempts: the first
 * request is immediate, then 30s, 1m, 3m, and 5m for every attempt after.
 * Index 0 is the never-attempted state, so `registerAttempt` (which counts from
 * 1) always lands on a real delay.
 */
const RESEND_BACKOFF_DELAYS = [0, 30, 60, 180, 300];

const delayForAttempt = (attempt: number): number =>
  RESEND_BACKOFF_DELAYS[Math.min(attempt, RESEND_BACKOFF_DELAYS.length - 1)];

export interface ResendBackoff {
  /** Seconds left before another attempt is allowed; 0 when one is. */
  countdown: number;
  /** False while a cooldown is running. */
  canResend: boolean;
  /** Count an attempt and open the cooldown window for the next one. */
  registerAttempt: () => void;
}

/**
 * Rate-limits a "resend the email" action with exponential backoff, shared by
 * the email-verification and password-reset screens so the two can't drift.
 *
 * The cooldown is tracked as a wall-clock deadline rather than a decrementing
 * counter: a tick that never fires — the JS thread blocked, or the app
 * backgrounded — would otherwise leave the user waiting longer than the delay
 * they were promised. Reading the remaining time from `Date.now()` makes the
 * countdown reflect elapsed real time instead of tick count.
 *
 * Callers should `registerAttempt()` after every attempt, successful or not, so
 * a failing send can't be retried in a tight loop.
 *
 * `initialAttempts` counts sends that happened before this hook mounted — the
 * activation mail that registration itself dispatches, for one. Without it the
 * verification screen opens with an open window and the first tap can burn one
 * of the three resends an hour the server allows, seconds after the first mail
 * went out.
 */
export function useResendBackoff(initialAttempts = 0): ResendBackoff {
  const [attempts, setAttempts] = useState(initialAttempts);
  // Lazy initializers: the deadline has to exist on the FIRST render, or the
  // countdown reads zero for a frame and the link renders enabled.
  const [cooldownUntil, setCooldownUntil] = useState(() =>
    initialAttempts > 0
      ? Date.now() + delayForAttempt(initialAttempts) * 1000
      : 0,
  );
  const [now, setNow] = useState(() => (initialAttempts > 0 ? Date.now() : 0));

  useEffect(() => {
    if (cooldownUntil === 0) return;

    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      // Stop ticking once the window closes; the next attempt restarts it by
      // moving the deadline.
      if (current >= cooldownUntil) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const countdown =
    cooldownUntil === 0
      ? 0
      : Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const registerAttempt = () => {
    const nextAttempt = attempts + 1;
    setAttempts(nextAttempt);

    const delay = delayForAttempt(nextAttempt);
    const startedAt = Date.now();
    setNow(startedAt);
    setCooldownUntil(startedAt + delay * 1000);
  };

  return { countdown, canResend: countdown === 0, registerAttempt };
}
