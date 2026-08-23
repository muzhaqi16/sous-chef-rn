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
 * Attempts before this gives up and reports, counted within ONE episode. A
 * restart that keeps failing is failing for a reason a seventh will not fix.
 * Giving up is not permanent: a socket that connects afterwards re-arms the
 * count from zero.
 */
export const MAX_RESTART_ATTEMPTS = 6;
const BASE_RESTART_DELAY_MS = 1000;
const MAX_RESTART_DELAY_MS = 30_000;

/**
 * How long a restarted subscription has to stay error-free before the count is
 * considered spent on a finished episode and returns to zero.
 *
 * The counterpart of `CONNECTION_STABLE_MS` in `wsLink.ts`, which re-arms the
 * socket's dial counter the same way and for the same reason: a counter that
 * only ever goes up stops measuring "consecutive failures" and starts measuring
 * "faults this session", so an accumulation of separately-recovered faults
 * exhausts it and leaves the subscription dark.
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

  // The count is spent on an EPISODE, not on the session. Apollo clears `error`
  // the moment `restart()` swaps in a fresh observable, so a restart that works
  // ends the episode here; if nothing errors again within the window, the next
  // fault gets the full number of attempts.
  //
  // Delivery is deliberately NOT the signal. It was, and it cannot be: a healthy
  // subscription can sit idle for hours, so "no events yet" is indistinguishable
  // from "the restart failed" — which is how six separately-recovered faults
  // used to exhaust the count and disable recovery for the rest of the session.
  useEffect(() => {
    if (shouldRecover || attempt === 0) return;

    const timeoutId = setTimeout(() => setAttempt(0), RESTART_STABLE_MS);
    return () => clearTimeout(timeoutId);
  }, [shouldRecover, attempt]);

  // A socket that connected is evidence this can work now, whoever revived it.
  // Restart at once instead of sitting out the rest of a backoff, and re-arm
  // the counter — including past the cap, so a long outage does not leave a
  // subscription dark for the session. The socket's own stability window is
  // what stops a connect/close loop from turning this into a hot restart cycle.
  //
  // This is also the ONLY way out of exhaustion, and it stays reachable: while
  // exhausted the error persists, so `shouldRecover` is still true and this
  // listener is still registered.
  useEffect(() => {
    if (!shouldRecover) return;

    return onWebSocketReconnected(() => {
      setAttempt(0);
      restart();
    });
  }, [shouldRecover, restart]);

  // Reported once per exhaustion, and it needs a latch. `exhausted` is not a
  // one-way door: `restart()` clears Apollo's `error`, so while the count sits
  // at the cap every clear-and-return of the error would re-run the effect with
  // `exhausted` still true and file the report again — one incident, several
  // "did not recover" reports.
  //
  // The latch is the payload itself, captured during render and cleared by the
  // count returning to zero — the same event that re-arms recovery, so the two
  // cannot drift: a subscription that recovers and later exhausts itself again
  // does report again. Holding the message rather than a boolean keeps the
  // effect's dependencies to values that change once per episode, which is what
  // makes "fires exactly once" a property of the deps rather than of a guard.
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
