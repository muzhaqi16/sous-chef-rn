import { useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import {
  DismissSuggestionDocument,
  UndismissSuggestionDocument,
} from '#operations/item/item.generated';
import type { SuggestionSurface } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';

interface DismissTarget {
  itemId: string;
  name: string;
}

/**
 * Dismiss/undismiss catalog items from a surface's suggestions (Add Again /
 * Favorites / Popular). The caller owns the optimistic removal (exit animation +
 * cache eviction), so the success path does NOT refetch — refetching mid-exit
 * would replace the cache arrays and cut the slide animation short. A refetch
 * runs only to restore the item on failure, and to bring it back on Undo.
 * Dismissals are per-user and per-surface, idempotent, and reversible.
 */
export function useSuggestionDismissal(
  surface: SuggestionSurface,
  refetch: () => void,
) {
  const { t } = useTranslation();
  const [dismiss] = useMutation(DismissSuggestionDocument);
  const [undismiss] = useMutation(UndismissSuggestionDocument);

  const undo = (itemId: string) => {
    undismiss({ variables: { input: { itemId, surface } } })
      // No optimistic re-add — the item comes back via the resync refetch
      // (and only if it still qualifies as a candidate).
      .then(() => refetch())
      .catch(() => toastService.error(t('addItemSheet.undoFailed')));
  };

  const dismissSuggestion = ({ itemId, name }: DismissTarget) => {
    toastService.success(t('addItemSheet.dismissed', { name }), {
      action: { label: t('addItemSheet.undo'), onPress: () => undo(itemId) },
    });

    dismiss({ variables: { input: { itemId, surface } } })
      .then(result => {
        const payload = result.data?.dismissSuggestion;
        // Union error variants resolve in `.then` (not `.catch`) — restore on
        // anything that isn't the success payload. Success needs no refetch: the
        // caller's optimistic removal already hid it, and the server-side
        // dismissal keeps it hidden on the next cache-and-network load.
        if (payload?.__typename !== 'DismissSuggestionPayload') {
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
