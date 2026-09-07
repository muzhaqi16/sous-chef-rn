import { useEffect, useState } from 'react';
import { useAppStore } from '#store/useAppStore';

export interface BiometricBackoff {
  /** Seconds left before another exchange may be sent; 0 when one may be. */
  countdown: number;
  /** False while the affordance is held after a refusal. */
  canAttempt: boolean;
}

/**
 * The hold placed on biometric sign-in after a refusal, as the button sees it.
 * A wall-clock DEADLINE lives in the store, so a backgrounded JS thread or a
 * relaunch cannot shorten it; this only renders what is left of it.
 */
export function useBiometricBackoff(): BiometricBackoff {
  const retryAt = useAppStore(state => state.biometricRetryAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (retryAt <= Date.now()) return;

    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [retryAt]);

  const countdown = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return { countdown, canAttempt: countdown === 0 };
}
