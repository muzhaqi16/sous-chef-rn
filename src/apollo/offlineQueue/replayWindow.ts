import { requireApolloClient } from '#/apollo/clientRegistry';
import { logger } from '#/utils/environment';
import { OfflineLimitsDocument } from './offlineLimits.generated';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * This build's own limit: a longer window from the server never extends it. The
 * API prunes its dedup records past its window, when a replay applies again.
 */
const MAX_REPLAY_WINDOW_MS = 90 * DAY_MS;

/**
 * The offline promise the API states as its minimum, under any window it sets,
 * so only a write this old can be past the window and worth a read.
 */
export const PROMISED_WINDOW_MS = 30 * DAY_MS;

let replayWindow = MAX_REPLAY_WINDOW_MS;
let hasRead = false;

/** How long a queued write stays safe to send, past which it can apply twice. */
export const replayWindowMs = (): number => replayWindow;

/**
 * Asks the server before the first replay it could affect, once a process. An
 * unanswered read keeps the build's limit and tries again at the next drain.
 */
export async function readReplayWindow(): Promise<void> {
  if (hasRead) return;
  try {
    const { data } = await requireApolloClient().query({
      query: OfflineLimitsDocument,
      fetchPolicy: 'no-cache',
    });
    if (!data) return;
    replayWindow = Math.min(
      data.offlineLimits.replayWindowDays * DAY_MS,
      MAX_REPLAY_WINDOW_MS,
    );
    hasRead = true;
  } catch (error) {
    logger.warn('Queue: could not read the replay window', error);
  }
}

/** @internal */
export function resetReplayWindow(): void {
  replayWindow = MAX_REPLAY_WINDOW_MS;
  hasRead = false;
}
