/**
 * useConvertExpiredBatchesToWaste - Mutation hook for discarding all expired
 * batches within a pantry item (local-first, no optimistic write).
 *
 * No optimistic cache write — the conversion recomputes quantity across multiple
 * expired batches, which is too complex to mirror client-side, so the parent
 * item's quantity / active-batch count reconcile from the server response
 * (online) or from the replay / pantry subscription (offline). The original
 * mutation isn't replay-safe (the server writes waste ledger rows), so the queue
 * replays it through `syncConvertExpiredBatchesToWaste` keyed by a client-minted
 * `operationId`, applying the conversion exactly once.
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
    const operationId = generateEntityId();
    const result = await convertMutation({
      variables: { input: { pantryItemId } },
      context: { localFirst: true, operationId },
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

    // created (response reconciles quantity / batch counts) or queued
    // (replays via syncConvertExpiredBatchesToWaste).
    onSuccess?.();
    return true;
  };

  return { convertExpiredBatches, loading };
}
