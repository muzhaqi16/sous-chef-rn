import { useEffect, useState } from 'react';
import type { ErrorLike } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { onWebSocketReconnected } from '#/apollo/links/wsLink';
import { errorService } from '#/services/errorService';
import { useIsOnline } from '#store/useAppStore';
import { logger } from '#/utils/environment';
import { backoffDelay } from '#/utils/backoff';
import {
  classifyTransportTermination,
  isPermanentSubscriptionRejection,
  isRetryableServerEnd,
} from '#/utils/subscriptionErrorHandler';

/**
 * Re-subscribes when the TRANSPORT ends a subscription: Apollo never restarts an
 * errored sink. Covers a close graphql-ws won't re-dial, per
 * {@link classifyTransportTermination}, and an {@link isRetryableServerEnd}.
 */

/**
 * Attempts within ONE episode before giving up and reporting. Not permanent —
 * a socket that connects afterwards re-arms the count from zero.
 */
export const MAX_RESTART_ATTEMPTS = 6;
// Jitter so several subscriptions killed by one close don't re-dial together.
const RESTART_BACKOFF = { baseMs: 1000, maxMs: 30_000, jitter: 0.25 };

/**
 * Error-free time before the attempt count resets (as `CONNECTION_STABLE_MS` in
 * `wsLink.ts`): a count that only rises would add up separately-recovered
 * faults until the subscription goes dark.
 */
export const RESTART_STABLE_MS = 10_000;

/** The part of `useSubscription`'s result this needs. */
export interface RecoverableSubscription {
  error?: ErrorLike;
  restart: () => void;
}

export function useSubscriptionTransportRecovery(
  document: DocumentNode,
  subscription: RecoverableSubscription,
  /** The same `skip` passed to `useSubscription`. */
  skip: boolean,
): void {
  const subscriptionName = operationNameOf(document);
  const { error, restart } = subscription;
  const isOnline = useIsOnline();

  const [attempt, setAttempt] = useState(0);

  // `restart()` THROWS when the subscription is skipped, so `skip` gates every
  // path reaching it; read at render, so flipping it cancels a scheduled
  // restart through the effect cleanup below.
  const recoverable =
    !!error &&
    !isPermanentSubscriptionRejection(error) &&
    (classifyTransportTermination(error) !== null ||
      isRetryableServerEnd(error));
  const shouldRecover = !skip && recoverable;
  const exhausted = attempt >= MAX_RESTART_ATTEMPTS;

  useEffect(() => {
    // Offline is not a reason to burn attempts: the dial cannot succeed, and
    // this effect re-runs on the transition back, restarting immediately.
    if (!shouldRecover || exhausted || !isOnline) return;

    const delay = backoffDelay(attempt, RESTART_BACKOFF);
    logger.debug(
      `🔌 [${subscriptionName}] subscription ended — re-subscribing in ${Math.round(
        delay,
      )}ms (attempt ${attempt + 1}/${MAX_RESTART_ATTEMPTS})`,
    );

    const timeoutId = setTimeout(() => {
      setAttempt(current => current + 1);
      restart();
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [shouldRecover, exhausted, isOnline, attempt, restart, subscriptionName]);

  // Apollo clears `error` when `restart()` swaps in a fresh observable, so a
  // working restart ends the episode here. Event DELIVERY cannot be the signal:
  // a healthy subscription can sit idle for hours.
  useEffect(() => {
    if (shouldRecover || attempt === 0) return;

    const timeoutId = setTimeout(() => setAttempt(0), RESTART_STABLE_MS);
    return () => clearTimeout(timeoutId);
  }, [shouldRecover, attempt]);

  // A connected socket restarts at once and re-arms the counter PAST the cap:
  // the only way out of exhaustion, reachable because the persisting error
  // keeps `shouldRecover` true.
  useEffect(() => {
    if (!shouldRecover) return;

    return onWebSocketReconnected(() => {
      setAttempt(0);
      restart();
    });
  }, [shouldRecover, restart]);

  // Latched: `restart()` clears Apollo's `error`, so each return to the cap would
  // report again. The latch is the PAYLOAD, cleared by the count-reset that
  // re-arms recovery, so a later exhaustion reports again.
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
