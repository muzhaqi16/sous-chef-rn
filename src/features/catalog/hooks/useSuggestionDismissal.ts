import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  MarkSuggestionDismissedDocument,
  MarkSuggestionActiveDocument,
  type MarkSuggestionActiveMutationVariables,
} from '#operations/item/item.generated';
import type { SuggestionSurface } from '#/graphql/generated/schemaTypes';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation, type Settled } from '#/apollo/utils/settleMutation';
import { toastService } from '#/services/toastService';
import { generateEntityId } from '#/utils/generateEntityId';
import {
  readHeldSuggestions,
  type HeldSuggestion,
  type SuggestionParent,
} from '#features/catalog/cache/suggestions';
import type {
  DismissSuggestionInputs,
  UndoDismissalInputs,
} from '#features/catalog/offline/localWrites';

type UndoVariables = MarkSuggestionActiveMutationVariables;

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
  const [dismiss] = useMutation(MarkSuggestionDismissedDocument, {
    context: { localFirst: true },
  });
  const [undismiss] = useMutation(MarkSuggestionActiveDocument, {
    context: { localFirst: true },
  });

  const undo = async (
    from: SuggestionParent,
    itemId: string,
    held: HeldSuggestion[],
    dismissed: Promise<Settled<unknown>>,
  ) => {
    const inputs: UndoDismissalInputs = { parent: from, held };
    await pendingWritesOf(client.cache).send<unknown, UndoVariables>(
      MarkSuggestionActiveDocument,
      { input: { itemId, surface, idempotencyKey: generateEntityId() } },
      async write => {
        // Sent after the dismissal settles, so the server cannot apply the two
        // out of order; a dismissal that failed left nothing to undo.
        const outcome = await dismissed;
        if (outcome.status === 'failed') return outcome;
        return settleMutation(() => undismiss(write), {
          document: MarkSuggestionActiveDocument,
          fallback: t('addItemSheet.undoFailed'),
          present: 'toast',
        });
      },
      inputs,
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
    const dismissed = pendingWritesOf(client.cache).send(
      MarkSuggestionDismissedDocument,
      { input: { itemId, surface, idempotencyKey: generateEntityId() } },
      write =>
        settleMutation(() => dismiss(write), {
          document: MarkSuggestionDismissedDocument,
          fallback: t('addItemSheet.dismissFailed'),
          present: 'toast',
        }),
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
