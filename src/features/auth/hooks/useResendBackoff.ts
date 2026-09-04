import { useEffect, useState } from 'react';

/**
 * Seconds between resend attempts. Index 0 is the never-attempted state, so
 * `registerAttempt` (counting from 1) always lands on a real delay.
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
 * Exponential backoff for "resend the email". The cooldown is a wall-clock
 * DEADLINE, not a decrementing counter, so a blocked or backgrounded JS thread
 * cannot stretch it. Call `registerAttempt()` after every attempt, failures
 * included; `initialAttempts` covers sends made before mount.
 */
export function useResendBackoff(initialAttempts = 0): ResendBackoff {
  const [attempts, setAttempts] = useState(initialAttempts);
  // Lazy initializers: without a deadline on the FIRST render the countdown
  // reads zero for a frame and the link paints enabled.
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
