/**
 * The one hook that fires `MarkHomeAsDefault`, so every route that moves the
 * account default is local-first and writes `Home.isDefault`. Replay is safe
 * without a `Sync*` mapping: marking the same home twice is idempotent.
 */
import { useMutation, useApolloClient } from '@apollo/client/react';
import {
  MarkHomeAsDefaultDocument,
  type MarkHomeAsDefaultMutation,
} from '#operations/home/userSettings.generated';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  applyDefaultHome,
  restoreDefaultHome,
} from '#features/home/utils/defaultHomeCacheWrites';
import { useDefaultHomeSyncStore } from '#features/home/store/useDefaultHomeSyncStore';

interface MarkHomeAsDefaultResult {
  status: 'confirmed' | 'queued' | 'refused' | 'failed';
  serverPantry: { id: string } | null;
  /** False when the target was not cached, so no local write was applied. */
  applied: boolean;
  result?: { data?: MarkHomeAsDefaultMutation | null; error?: unknown };
}

export const useMarkHomeAsDefault = () => {
  const client = useApolloClient();
  const markPending = useDefaultHomeSyncStore(state => state.markPending);
  const markConfirmed = useDefaultHomeSyncStore(state => state.markConfirmed);
  const clearPending = useDefaultHomeSyncStore(state => state.clearPending);

  // Local-first rules out an `optimisticResponse`: offline, the queue's null
  // result counts as completion and tears the optimistic layer down.
  const [mutate] = useMutation(MarkHomeAsDefaultDocument, {
    context: { localFirst: true },
  });

  const markAsDefault = async (
    homeId: string,
  ): Promise<MarkHomeAsDefaultResult> => {
    const { applied, snapshot } = applyDefaultHome(client.cache, homeId);

    // Recorded even when unapplied, so a retry is not skipped as already done.
    markPending(homeId);

    let result;
    try {
      result = await mutate({ variables: { input: { homeId } } });
    } catch {
      restoreDefaultHome(client.cache, snapshot);
      clearPending();
      return { status: 'failed', serverPantry: null, applied };
    }

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      restoreDefaultHome(client.cache, snapshot);
      clearPending();
      return { status: 'refused', serverPantry: null, applied, result };
    }

    // Queued: local write and pending marker both stand until replay.
    if (outcome === 'queued') {
      return {
        status: 'queued',
        serverPantry: null,
        applied: applied || applyDefaultHome(client.cache, homeId).applied,
        result,
      };
    }

    markConfirmed(homeId);

    // The target may have reached the cache while the mutation was in flight
    // (a create's `update`, a join's refetch), so a write that could not land
    // before is retried here rather than waiting for the next full refetch.
    const settled = applied || applyDefaultHome(client.cache, homeId).applied;

    const payload = result.data?.markHomeAsDefault;
    const serverPantry =
      payload?.__typename === 'MarkHomeAsDefaultPayload'
        ? payload.defaultPantry ?? null
        : null;

    return { status: 'confirmed', serverPantry, applied: settled, result };
  };

  return { markAsDefault };
};
