import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  MarkSuggestionDismissedDocument,
  MarkSuggestionActiveDocument,
} from '#operations/item/item.generated';
import type { SuggestionSurface } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { settleMutation } from '#/apollo/utils/settleMutation';

interface DismissTarget {
  itemId: string;
  name: string;
}

/**
 * Dismiss/undismiss catalog items from a suggestion surface. The caller owns the
 * optimistic removal, so success does NOT refetch (it would cut the exit
 * animation short); a refetch restores the item on failure or Undo.
 */
export function useSuggestionDismissal(
  surface: SuggestionSurface,
  refetch: () => void,
) {
  const { t } = useTranslation();
  const [dismiss] = useMutation(MarkSuggestionDismissedDocument);
  const [undismiss] = useMutation(MarkSuggestionActiveDocument);

  const undo = async (itemId: string) => {
    const settled = await settleMutation(
      () => undismiss({ variables: { input: { itemId, surface } } }),
      {
        document: MarkSuggestionActiveDocument,
        fallback: t('addItemSheet.undoFailed'),
        present: 'toast',
      },
    );
    // A failed undo leaves the item dismissed server-side, so nothing refetches.
    if (settled.failure) return;
    refetch();
  };

  const settleDismissal = async (itemId: string) => {
    // Success needs no refetch: the caller's optimistic removal already hid it.
    await settleMutation(
      () => dismiss({ variables: { input: { itemId, surface } } }),
      {
        document: MarkSuggestionDismissedDocument,
        fallback: t('addItemSheet.dismissFailed'),
        onFailed: refetch,
        present: 'toast',
      },
    );
  };

  const dismissSuggestion = ({ itemId, name }: DismissTarget) => {
    toastService.success(t('addItemSheet.dismissed', { name }), {
      action: {
        label: t('addItemSheet.undo'),
        onPress: () => {
          void undo(itemId);
        },
      },
    });
    void settleDismissal(itemId);
  };

  return { dismissSuggestion };
}
