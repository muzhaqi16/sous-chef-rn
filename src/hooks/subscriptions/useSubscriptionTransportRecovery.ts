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
 * Re-subscribes when the TRANSPORT ends a subscription — Apollo has no automatic
 * restart and the client is `lazy`, so an errored sink stays dark. Covers only
 * the closes graphql-ws refuses to re-dial, never one that latched reconnection
 * off; {@link classifyTransportTermination} is the table the socket reads too.
 */

/**
 * Attempts within ONE episode before giving up and reporting. Not permanent —
 * a socket that connects afterwards re-arms the count from zero.
 */
export const MAX_RESTART_ATTEMPTS = 6;
const BASE_RESTART_DELAY_MS = 1000;
const MAX_RESTART_DELAY_MS = 30_000;

/**
 * Error-free time before the attempt count returns to zero. Counterpart of
 * `CONNECTION_STABLE_MS` in `wsLink.ts`: a counter that only goes up measures
 * "faults this session", not consecutive failures, so separately-recovered
 * faults would accumulate until the subscription goes dark.
 */
export const RESTART_STABLE_MS = 10_000;

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
  error?: ErrorLike;
  restart: () => void;
}

export function useSubscriptionTransportRecovery(
  subscriptionName: string,
  subscription: RecoverableSubscription,
  /** The same `skip` passed to `useSubscription`. */
  skip: boolean,
): void {
  const { error, restart } = subscription;
  const isOnline = useIsOnline();

  const [attempt, setAttempt] = useState(0);

  // `restart()` THROWS when the subscription is skipped, so `skip` gates every
  // path reaching it; read at render, so flipping it cancels a scheduled
  // restart through the effect cleanup below.
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

  // The count is spent on an EPISODE, not on the session: Apollo clears `error`
  // when `restart()` swaps in a fresh observable, so a working restart ends the
  // episode here. Event DELIVERY cannot be the signal — a healthy subscription
  // can sit idle for hours, so "no events yet" is not "the restart failed".
  useEffect(() => {
    if (shouldRecover || attempt === 0) return;

    const timeoutId = setTimeout(() => setAttempt(0), RESTART_STABLE_MS);
    return () => clearTimeout(timeoutId);
  }, [shouldRecover, attempt]);

  // A connected socket is evidence this can work now: restart at once and re-arm
  // the counter, PAST the cap, so a long outage cannot leave a subscription dark
  // for the session. This is the only way out of exhaustion, and it stays
  // reachable because the error persists, keeping `shouldRecover` true.
  useEffect(() => {
    if (!shouldRecover) return;

    return onWebSocketReconnected(() => {
      setAttempt(0);
      restart();
    });
  }, [shouldRecover, restart]);

  // Latched, because `exhausted` is not a one-way door: `restart()` clears
  // Apollo's `error`, so each clear-and-return at the cap would file the report
  // again. The latch is the PAYLOAD, cleared by the same count-reset that re-arms
  // recovery — so "fires once per episode" is a property of the deps, not a
  // guard, and a later exhaustion does report again.
  const errorMessage = error?.message;
  const [exhaustionReport, setExhaustionReport] = useState<string | null>(null);

  if (attempt === 0 && exhaustionReport !== null) {
    setExhaustionReport(null);
  } else if (shouldRecover && exhausted && exhaustionReport === null) {
    setExhaustionReport(errorMessage ?? '');
  }

  useEffect(() => {
    if (exhaustionReport === null) return;

    errorService.reportError(
      new Error(
        `Subscription ${subscriptionName} did not recover after ${MAX_RESTART_ATTEMPTS} restarts`,
      ),
      {
        operation: 'subscriptionTransportRecoveryExhausted',
        subscription: subscriptionName,
        error: exhaustionReport || undefined,
      },
    );
  }, [exhaustionReport, subscriptionName]);
}
