import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { ChangePantryItemItemDocument } from '#features/pantry/hooks/mutations/useMovePantryItem.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { presentFailure } from '#/utils/errors/presentFailure';
import { todayKey } from '#/utils/dateUtils';

/**
 * `receiptCorrectionRecorded`: the household's next receipt reads the stock's
 * lines as the new item. `duplicate`: the pantry already holds the new item in
 * this unit, so nothing moved; that stack is named. Any other failure is
 * already reported.
 */
export type MoveOutcome =
  | { status: 'moved'; receiptCorrectionRecorded: boolean }
  | { status: 'duplicate'; existingPantryItemId: string }
  | { status: 'failed' };

/** Moves a pantry stack onto another catalog item, keeping all of its stock. */
export function useMovePantryItem() {
  const { t } = useTranslation();
  const [changeItem, { loading }] = useMutation(ChangePantryItemItemDocument);

  const moveToItem = async (
    stack: { id: string; version: number },
    itemId: string,
    onConflictRefresh: () => void,
  ): Promise<MoveOutcome> => {
    const settled = await settleMutation(
      () =>
        changeItem({
          variables: {
            input: { pantryItemId: stack.id, itemId, version: stack.version },
            today: todayKey(),
          },
        }),
      {
        document: ChangePantryItemItemDocument,
        title: t('relinkItem.failedTitle'),
        fallback: t('relinkItem.failedBody'),
        present: 'none',
      },
    );

    const payload = appliedPayload(settled.data);
    if (payload) {
      return {
        status: 'moved',
        receiptCorrectionRecorded: payload.receiptCorrectionRecorded,
      };
    }
    const refusal = settled.data?.changePantryItemItem;
    if (refusal?.__typename === 'DuplicatePantryItemError') {
      const [existingPantryItemId] = refusal.existingPantryItemIds;
      if (existingPantryItemId) {
        return { status: 'duplicate', existingPantryItemId };
      }
    }
    if (settled.failure) presentFailure(settled.failure, { onConflictRefresh });
    return { status: 'failed' };
  };

  return { moveToItem, moving: loading };
}
