/**
 * useOpenPantryItemBatch - Mutation hook for marking a batch as opened
 * (local-first).
 *
 * Writes `isOpened`/`openedAt` to the cached batch PERMANENTLY before firing so
 * the opened state shows instantly and survives an offline/queued open. The
 * open is naturally idempotent (re-opening is a no-op), and the canonical
 * mutation carries a client-minted `input.idempotencyKey` so a queued replay is
 * deduped at the server too. A real rejection restores the pre-open snapshot.
 */

import { useMutation } from '@apollo/client/react';
import { OpenPantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import { handleMutationError } from '#/utils/errorHandlers';
import { useWrite } from '#/apollo/write/useWrite';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n';
import { generateEntityId } from '#/utils/generateEntityId';

interface UseOpenPantryItemBatchOptions {
  onSuccess?: () => void;
}

export function useOpenPantryItemBatch({
  onSuccess,
}: UseOpenPantryItemBatchOptions = {}) {
  const [openMutation, { loading }] = useMutation(OpenPantryItemBatchDocument, {
    onError: error => {
      handleMutationError(error, { operation: 'Open Batch' });
    },
  });

  const { apply } = useWrite();

  const openBatch = async (batchId: string): Promise<boolean> => {
    const now = new Date().toISOString();

    // The batch's persisted marker is gone with this: it named a typename no
    // screen ever registered for restoration, so it was written and never read.
    // The intent on the queue entry is the durable record now.
    const { context, revert } = apply({
      target: { __typename: 'PantryItemBatch', id: batchId },
      patch: { isOpened: true, openedAt: now },
      convergence: 'absolute',
    });

    const result = await openMutation({
      variables: { input: { batchId, idempotencyKey: generateEntityId() } },
      context,
    });

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      revert();
      // onError covers transport errors; a non-success union payload has none.
      alertRejectedMutation(result, t('errors.openBatchFailed'));
      return false;
    }

    onSuccess?.();
    return true;
  };

  return { openBatch, loading };
}
