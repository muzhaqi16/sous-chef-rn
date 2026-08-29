/**
 * useConvertExpiredBatchesToWaste - Mutation hook for discarding all expired
 * batches within a pantry item (local-first).
 *
 * The write is declared through the kit, but its patch is EMPTY: the conversion
 * recomputes `quantity`, `activeBatchCount` and `earliestBatchExpiration` across
 * an unknown set of expired batches, and the client never fetches batch rows —
 * `PantryItem` exposes only the two derived counts — so there is no local value
 * to write and therefore none to undo. The item reconciles from the server
 * response (online) or from the replay / pantry subscription (offline).
 *
 * Declaring the empty intent anyway is what keeps the withdrawal honest. A
 * queued write with no intent falls back to evicting its entity, and this one
 * names the pantry item in `input.pantryItemId` — so a permanently-refused
 * replay used to drop a row whose local state had never been touched, with no
 * read able to bring it back offline. An empty inverse restores exactly what the
 * write changed: nothing.
 *
 * The server writes waste ledger rows, so a naive replay would double-count —
 * the canonical mutation carries a client-minted `input.idempotencyKey` that the
 * server records in the same transaction, applying the conversion exactly once
 * (a replay returns ConflictError(IDEMPOTENT_REPLAY), which the queue
 * converges).
 */

import { useMutation } from '@apollo/client/react';
import { ConvertExpiredBatchesToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import { handleMutationError } from '#/utils/errorHandlers';
import { useWrite } from '#/apollo/write/useWrite';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { t } from '#/i18n';

interface UseConvertExpiredBatchesToWasteOptions {
  onSuccess?: () => void;
}

export function useConvertExpiredBatchesToWaste({
  onSuccess,
}: UseConvertExpiredBatchesToWasteOptions = {}) {
  const { apply } = useWrite();

  const [convertMutation, { loading }] = useMutation(
    ConvertExpiredBatchesToWasteDocument,
    {
      onError: error => {
        handleMutationError(error, {
          operation: 'Convert Expired Batches To Waste',
        });
      },
    },
  );

  const convertExpiredBatches = async (
    pantryItemId: string,
  ): Promise<boolean> => {
    // Relative: the input names no final value at all — it says "discard
    // whatever is expired", which the server resolves against its own batches.
    // Re-sending it against a refreshed version would ask for a second
    // conversion, so a conflict is reported rather than replayed. (The input
    // carries no `version` either, so the absolute path could not refresh one.)
    const { context, revert } = apply({
      target: { __typename: 'PantryItem', id: pantryItemId },
      patch: {},
      convergence: 'relative',
    });

    const result = await convertMutation({
      variables: {
        input: { pantryItemId, idempotencyKey: generateEntityId() },
      },
      context,
    });

    // `classifyCreateResult` folds BOTH refusal channels into `'rejected'` — a
    // non-success union payload (HTTP 200, no `error`) and a resolved transport
    // error — so one branch covers both. The revert is a no-op by construction
    // here; it is called so the write's withdrawal has one shape, not two.
    if (classifyCreateResult(result) === 'rejected') {
      revert();
      // Suppresses itself when `result.error` is set, where the mutation's
      // `onError` is the one reporter.
      alertRejectedMutation(result, t('errors.discardExpiredFailed'));
      return false;
    }

    // created (response reconciles quantity / batch counts) or queued (replays
    // the canonical mutation, deduped by its idempotencyKey).
    onSuccess?.();
    return true;
  };

  return { convertExpiredBatches, loading };
}
