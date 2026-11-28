import { useApolloClient } from '@apollo/client/react';
import { useTranslation } from '#i18n';
import type { SuggestionSurface } from '#graphql/generated/schemaTypes';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import type { Settled } from '#apollo/utils/settleMutation';
import { toastService } from '#services/toastService';
import { generateEntityId } from '#utils/generateEntityId';
import {
  readHeldSuggestions,
  type HeldSuggestion,
  type SuggestionParent,
} from '#features/catalog/cache/suggestions';
import type {
  DismissSuggestionInputs,
  UndoDismissalInputs,
} from '#features/catalog/offline/localWrites';
import {
  markSuggestionActiveWrite,
  markSuggestionDismissedWrite,
} from '#features/catalog/offline/localWrites';

interface DismissTarget {
  itemId: string;
  name: string;
}

/**
 * Dismiss/undismiss catalog items from a suggestion surface. Both are pending
 * layers: a failure drops the dismissal, and an Undo puts back exactly the
 * entries taken, never a refetch, which would also restore suggestions whose
 * own writes are still in flight.
 */
export function useSuggestionDismissal(
  surface: SuggestionSurface,
  parent: SuggestionParent | undefined,
) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const dismiss = useLocalWrite(markSuggestionDismissedWrite, {
    fallback: t('addItemSheet.dismissFailed'),
    present: 'toast',
  });
  const undismiss = useLocalWrite(markSuggestionActiveWrite, {
    fallback: t('addItemSheet.undoFailed'),
    present: 'toast',
  });

  const undo = async (
    from: SuggestionParent,
    itemId: string,
    held: HeldSuggestion[],
    dismissed: Promise<Settled<unknown>>,
  ) => {
    const inputs: UndoDismissalInputs = { parent: from, held };
    await undismiss.send(
      { input: { itemId, surface, idempotencyKey: generateEntityId() } },
      inputs,
      {
        // A dismissal that failed left nothing to undo. One on its way or
        // queued keeps this behind it, as both share an `orderedBy`.
        ready: async write =>
          (await dismissed).status === 'failed' ? null : write,
      },
    );
  };

  const dismissSuggestion = ({ itemId, name }: DismissTarget) => {
    if (!parent) return;
    const held = readHeldSuggestions(client.cache, parent, itemId);
    // Already taken: this tap's dismissal is on its way.
    if (held.length === 0) return;
    const inputs: DismissSuggestionInputs = { parent };
    // One key per tap, kept by the queued write and its replays: a re-send
    // under a spent key writes nothing, so it never undoes a later Undo.
    const dismissed = dismiss.send(
      { input: { itemId, surface, idempotencyKey: generateEntityId() } },
      inputs,
    );
    toastService.success(t('addItemSheet.dismissed', { name }), {
      action: {
        label: t('labels.undo'),
        onPress: () => {
          void undo(parent, itemId, held, dismissed);
        },
      },
    });
  };

  return { dismissSuggestion };
}
