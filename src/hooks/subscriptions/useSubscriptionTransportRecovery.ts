import { useEffect, useState } from 'react';
import type { ErrorLike } from '@apollo/client';
import { onWebSocketReconnected } from '#/apollo/links/wsLink';
import { errorService } from '#/services/errorService';
import { useIsOnline } from '#store/useAppStore';
import { logger } from '#/utils/environment';
import {
  classifyTransportTermination,
  isPermanentSubscriptionRejection,
} from '#/utils/subscriptionErrorHandler';

/**
 * Re-subscribe when the TRANSPORT ends a subscription.
 *
 * Apollo's `useSubscription` has no automatic restart — only a manual
 * `restart()` — so a subscription whose sink errors is finished, and the socket
 * returning afterwards changes nothing: the client is `lazy`, so with nothing
 * subscribed there is nothing to make it dial. Every subscription here is
 * mounted once for the session, so "finished" meant no real-time updates until
 * the screen was remounted, with nothing surfaced to the user.
 *
 * graphql-ws re-dials on its own after most closes and that path never errors
 * the sink. This covers the closes where it refuses to:
 *
 *  - the codes it treats as fatal regardless of `shouldRetry` — 4429, 4500 and
 *    the rest of `isLibraryFatalCloseCode`; and
 *  - retry exhaustion.
 *
 * It does NOT restart a close that latched reconnection off — an upgrade
 * requirement, a dead session, a refused API key, a protocol bug. That verdict
 * comes from the same table the socket reads, through
 * {@link classifyTransportTermination}, so the two cannot disagree.
 *
 * Called as a separate line beside `useSubscription` rather than wrapping it,
 * so the subscription keeps Apollo's own typing and the recovery is visible at
 * the call site. `__tests__/apollo/transportRecoveryCoverage.test.ts`
 * is what stops a new subscription from quietly going without it.
 *
 * Distinct from `handleSubscriptionError`, which covers a server resolver
 * returning a non-iterable — a document-shaped fault, not a transport one.
 */

/**
 * Attempts before this gives up and reports. A restart that keeps failing is
 * failing for a reason a seventh will not fix. Giving up is not permanent: a
 * socket that connects afterwards re-arms the count from zero.
 */
const MAX_RESTART_ATTEMPTS = 6;
const BASE_RESTART_DELAY_MS = 1000;
const MAX_RESTART_DELAY_MS = 30_000;

const getRestartDelay = (attempt: number): number => {
  const delay = Math.min(
    BASE_RESTART_DELAY_MS * Math.pow(2, attempt),
    MAX_RESTART_DELAY_MS,
  );
  // Jitter so several subscriptions killed by one close don't re-dial together.
  return delay + delay * 0.25 * Math.random();
};

/** The part of `useSubscription`'s result this needs. */
export interface RecoverableSubscription {
  data?: unknown;
  error?: ErrorLike;
  restart: () => void;
}

export function useSubscriptionTransportRecovery(
  subscriptionName: string,
  subscription: RecoverableSubscription,
  /** The same `skip` passed to `useSubscription`. */
  skip: boolean,
): void {
  const { data, error, restart } = subscription;
  const isOnline = useIsOnline();

  const [attempt, setAttempt] = useState(0);

  // Any delivery proves the transport is carrying this subscription again, so
  // the escalation resets. Adjusting state during render rather than in an
  // effect keeps the reset in the same commit as the data that justified it.
  const [lastData, setLastData] = useState(data);
  if (data !== lastData) {
    setLastData(data);
    if (attempt !== 0) setAttempt(0);
  }

  // `restart()` throws when the subscription is skipped, so `skip` gates every
  // path that can reach it. It is read at render, so flipping it cancels a
  // scheduled restart through the effect cleanup below.
  const transportEnded =
    !!error &&
    !isPermanentSubscriptionRejection(error) &&
    classifyTransportTermination(error) !== null;
  const shouldRecover = !skip && transportEnded;
  const exhausted = attempt >= MAX_RESTART_ATTEMPTS;

  useEffect(() => {
    // Offline is not a reason to burn attempts: the dial cannot succeed, and
    // this effect re-runs on the transition back, restarting immediately.
    if (!shouldRecover || exhausted || !isOnline) return;

    const delay = getRestartDelay(attempt);
    logger.debug(
      `🔌 [${subscriptionName}] transport ended the subscription — re-subscribing in ${Math.round(
        delay,
      )}ms (attempt ${attempt + 1}/${MAX_RESTART_ATTEMPTS})`,
    );

    const timeoutId = setTimeout(() => {
      setAttempt(current => current + 1);
      restart();
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [shouldRecover, exhausted, isOnline, attempt, restart, subscriptionName]);

  // A socket that connected is evidence this can work now, whoever revived it.
  // Restart at once instead of sitting out the rest of a backoff, and re-arm
  // the counter — including past the cap, so a long outage does not leave a
  // subscription dark for the session. The socket's own stability window is
  // what stops a connect/close loop from turning this into a hot restart cycle.
  useEffect(() => {
    if (!shouldRecover) return;

    return onWebSocketReconnected(() => {
      setAttempt(0);
      restart();
    });
  }, [shouldRecover, restart]);

  // Reported once per exhaustion, without a latch to keep in sync: `exhausted`
  // only becomes true once, and nothing increments `attempt` past the cap. A
  // socket reconnect resets the count, which is exactly when a later failure
  // deserves reporting again.
  const errorMessage = error?.message;
  useEffect(() => {
    if (!shouldRecover || !exhausted) return;

    errorService.reportError(
      new Error(
        `Subscription ${subscriptionName} did not recover after ${MAX_RESTART_ATTEMPTS} restarts`,
      ),
      {
        operation: 'subscriptionTransportRecoveryExhausted',
        subscription: subscriptionName,
        error: errorMessage,
      },
    );
  }, [shouldRecover, exhausted, subscriptionName, errorMessage]);
}
