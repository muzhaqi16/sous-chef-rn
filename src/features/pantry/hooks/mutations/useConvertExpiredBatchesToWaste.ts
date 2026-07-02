/**
 * useConvertExpiredBatchesToWaste - Mutation hook for discarding all expired
 * batches within a pantry item (local-first, no optimistic write).
 *
 * No optimistic cache write — the conversion recomputes quantity across multiple
 * expired batches, which is too complex to mirror client-side, so the parent
 * item's quantity / active-batch count reconcile from the server response
 * (online) or from the replay / pantry subscription (offline). The server writes
 * waste ledger rows, so a naive replay would double-count — the canonical
 * mutation carries a client-minted `input.idempotencyKey` that the server
 * records in the same transaction, applying the conversion exactly once (a
 * replay returns ConflictError(IDEMPOTENT_REPLAY), which the queue converges).
 */

import { useMutation } from '@apollo/client/react';
import { ConvertExpiredBatchesToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import { handleMutationError } from '#/utils/errorHandlers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { t } from '#/i18n/t';

interface UseConvertExpiredBatchesToWasteOptions {
  onSuccess?: () => void;
}

export function useConvertExpiredBatchesToWaste({
  onSuccess,
}: UseConvertExpiredBatchesToWasteOptions = {}) {
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
    const result = await convertMutation({
      variables: {
        input: { pantryItemId, idempotencyKey: generateEntityId() },
      },
      context: { localFirst: true },
    });

    const outcome = classifyCreateResult(
      result,
      'convertExpiredBatchesToWaste',
      'ConvertExpiredBatchesToWastePayload',
    );

    if (outcome === 'rejected') {
      // onError covers transport errors; a non-success union payload has none.
      alertRejectedMutation(result, t('errors.removeItemFailed'));
      return false;
    }

    // created (response reconciles quantity / batch counts) or queued (replays
    // the canonical mutation, deduped by its idempotencyKey).
    onSuccess?.();
    return true;
  };

  return { convertExpiredBatches, loading };
}
