import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  MarkSuggestionDismissedDocument,
  MarkSuggestionActiveDocument,
} from '#operations/item/item.generated';
import type { SuggestionSurface } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { settleMutation, type Settled } from '#/apollo/utils/settleMutation';

interface DismissTarget {
  itemId: string;
  name: string;
}

/**
 * The sheet's own cache write: takes a suggestion out, and puts it back.
 * `remove` answers `null` when no list held the item, as after a second tap.
 */
interface SuggestionCacheWrites<TRemoval> {
  remove: (itemId: string) => TRemoval | null;
  restore: (removal: TRemoval) => void;
}

/**
 * Dismiss/undismiss catalog items from a suggestion surface. Both writes are
 * local-first: the suggestion leaves the cache before the dismissal is sent,
 * and a failure or Undo puts back exactly what was taken, never a refetch,
 * which would also restore suggestions whose own writes are still in flight.
 */
export function useSuggestionDismissal<TRemoval>(
  surface: SuggestionSurface,
  { remove, restore }: SuggestionCacheWrites<TRemoval>,
) {
  const { t } = useTranslation();
  const [dismiss] = useMutation(MarkSuggestionDismissedDocument, {
    context: { localFirst: true },
  });
  const [undismiss] = useMutation(MarkSuggestionActiveDocument, {
    context: { localFirst: true },
  });

  const undo = async (
    itemId: string,
    removal: TRemoval,
    dismissed: Promise<Settled<unknown>>,
  ) => {
    restore(removal);
    // Sent after the dismissal settles, so the server cannot apply the two out
    // of order; a dismissal that failed left nothing to undo.
    if ((await dismissed).status === 'failed') return;
    await settleMutation(
      () => undismiss({ variables: { input: { itemId, surface } } }),
      {
        document: MarkSuggestionActiveDocument,
        fallback: t('addItemSheet.undoFailed'),
        // Still dismissed server-side: take it out again.
        onFailed: () => {
          remove(itemId);
        },
        present: 'toast',
      },
    );
  };

  const dismissSuggestion = ({ itemId, name }: DismissTarget) => {
    const removal = remove(itemId);
    // Already taken: this tap's dismissal is on its way.
    if (removal === null) return;
    const dismissed = settleMutation(
      () => dismiss({ variables: { input: { itemId, surface } } }),
      {
        document: MarkSuggestionDismissedDocument,
        fallback: t('addItemSheet.dismissFailed'),
        onFailed: () => restore(removal),
        present: 'toast',
      },
    );
    toastService.success(t('addItemSheet.dismissed', { name }), {
      action: {
        label: t('addItemSheet.undo'),
        onPress: () => {
          void undo(itemId, removal, dismissed);
        },
      },
    });
  };

  return { dismissSuggestion };
}
