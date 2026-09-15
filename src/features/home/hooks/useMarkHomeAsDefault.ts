/**
 * The one hook that fires `MarkHomeAsDefault`, so every route that moves the
 * account default is local-first and writes `Home.isDefault`. Replay is safe
 * without a `Sync*` mapping: marking the same home twice is idempotent.
 */
import { useMutation, useApolloClient } from '@apollo/client/react';
import { MarkHomeAsDefaultDocument } from '#operations/home/userSettings.generated';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import {
  applyDefaultHome,
  restoreDefaultHome,
} from '#features/home/utils/defaultHomeCacheWrites';
import { useDefaultHomeSyncStore } from '#features/home/store/useDefaultHomeSyncStore';

interface MarkHomeAsDefaultResult {
  /** `refused`: the server ruled against it. `failed`: it never ruled. */
  status: 'confirmed' | 'queued' | 'refused' | 'failed';
  serverPantry: { id: string } | null;
  /** False when the target was not cached, so no local write was applied. */
  applied: boolean;
  /** The localized copy for a refused or failed write; the caller presents it. */
  failure?: SettledFailure;
}

export const useMarkHomeAsDefault = () => {
  const { t } = useTranslation();
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

    const settled = await settleMutation(
      () => mutate({ variables: { input: { homeId } } }),
      {
        document: MarkHomeAsDefaultDocument,
        fallback: t('errors.setDefaultHomeFailed'),
        present: 'none',
        onFailed: () => {
          restoreDefaultHome(client.cache, snapshot);
          clearPending();
        },
      },
    );

    if (settled.failure) {
      // A refusal carries its member in `data`; settling reports only the
      // failures that never reached a ruling, and a lost default is silent.
      const refused = !!settled.data?.markHomeAsDefault;
      if (refused) {
        errorService.reportError(
          new Error(`Default home refused: ${settled.failure.code ?? ''}`),
          { operation: operationNameOf(MarkHomeAsDefaultDocument) },
        );
      }
      return {
        status: refused ? 'refused' : 'failed',
        serverPantry: null,
        applied,
        failure: settled.failure,
      };
    }

    // Queued: local write and pending marker both stand until replay.
    if (settled.status === 'queued') {
      return {
        status: 'queued',
        serverPantry: null,
        applied: applied || applyDefaultHome(client.cache, homeId).applied,
      };
    }

    markConfirmed(homeId);

    // The target may have reached the cache while the mutation was in flight
    // (a create's `update`, a join's refetch), so a write that could not land
    // before is retried here rather than waiting for the next full refetch.
    const landed = applied || applyDefaultHome(client.cache, homeId).applied;

    const payload = appliedPayload(settled.data);
    const serverPantry = payload ? payload.defaultPantry ?? null : null;

    return { status: 'confirmed', serverPantry, applied: landed };
  };

  return { markAsDefault };
};
