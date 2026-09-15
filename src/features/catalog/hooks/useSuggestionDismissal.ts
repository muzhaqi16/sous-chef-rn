import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  MarkSuggestionDismissedDocument,
  MarkSuggestionActiveDocument,
} from '#operations/item/item.generated';
import type { SuggestionSurface } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { appliedPayload } from '#/utils/errors/mutationPayload';

interface DismissTarget {
  itemId: string;
  name: string;
}

/**
 * Dismiss/undismiss catalog items from a suggestion surface. The caller owns
 * the optimistic removal, so the success path does NOT refetch — that would
 * replace the cache arrays and cut the exit animation short. Refetch runs only
 * to restore the item on failure or on Undo.
 */
export function useSuggestionDismissal(
  surface: SuggestionSurface,
  refetch: () => void,
) {
  const { t } = useTranslation();
  const [dismiss] = useMutation(MarkSuggestionDismissedDocument);
  const [undismiss] = useMutation(MarkSuggestionActiveDocument);

  const undo = (itemId: string) => {
    undismiss({ variables: { input: { itemId, surface } } })
      .then(result => {
        // Union error variants resolve in `.then` (not `.catch`) — mirror
        // dismissSuggestion and only act on the success payload. On success the
        // item comes back via the resync refetch (if it still qualifies). A
        // rejected undo surfaces an error instead of silently doing nothing.
        if (appliedPayload(result.data)) {
          refetch();
        } else {
          toastService.error(t('addItemSheet.undoFailed'));
        }
      })
      .catch(() => toastService.error(t('addItemSheet.undoFailed')));
  };

  const dismissSuggestion = ({ itemId, name }: DismissTarget) => {
    toastService.success(t('addItemSheet.dismissed', { name }), {
      action: { label: t('addItemSheet.undo'), onPress: () => undo(itemId) },
    });

    dismiss({ variables: { input: { itemId, surface } } })
      .then(result => {
        // Union error variants resolve in `.then` (not `.catch`) — restore on
        // anything that isn't the success payload. Success needs no refetch: the
        // caller's optimistic removal already hid it, and the server-side
        // dismissal keeps it hidden on the next cache-and-network load.
        if (!appliedPayload(result.data)) {
          refetch();
          toastService.error(t('addItemSheet.dismissFailed'));
        }
      })
      .catch(() => {
        refetch();
        toastService.error(t('addItemSheet.dismissFailed'));
      });
  };

  return { dismissSuggestion };
}
