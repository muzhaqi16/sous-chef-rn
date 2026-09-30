import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  addPantryItemLocally,
  addToPantryItemsCache,
  revertOptimisticPantryItem,
} from '#features/pantry/cache/items';
import { writeLocalPantryItem } from '#features/pantry/cache/writeLocalPantryItem';
import { getPantryItemDuplicateFromResult } from '#domain/pantryItemDuplicate';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { adoptServerEntityId } from '#/apollo/utils/cacheUpdaters';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { generateEntityId } from '#/utils/generateEntityId';
import { todayKey } from '#/utils/dateUtils';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';

/** What became of an add. The caller owns the toast and the animation. */
export type AddPantryItemOutcome =
  | { status: 'added' }
  | { status: 'duplicate'; existingPantryItemId: string }
  | { status: 'rejected' };

/**
 * The pantry's local-first create: the row is written before the mutation
 * fires, withdrawn on a refusal or a duplicate, and kept when the create is
 * queued. Public so another feature's intake (a receipt) shares one path.
 */
export function usePantryIntake(pantryId: string | undefined) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [createPantryItem] = useMutation(CreatePantryItemDocument, {
    context: { localFirst: true },
    update: (cache, { data }, { variables }) => {
      const payload = appliedPayload(data);
      if (!payload || !pantryId) return;
      const pantryItem = payload.pantryItem;
      // Read outside the try: `?.` is a value block, and one inside a try body
      // bails the React Compiler out of the whole function.
      const clientId = variables?.input.id;

      try {
        // NOT the counting helper: the eager write already counted this row.
        // This re-add reconciles the server's entity into the same edge.
        addToPantryItemsCache(cache, pantryId, pantryItem);
        // The re-add dedupes BY ID, so a server-resolved id divergence would
        // leave the client cuid as a second, permanently unresolvable edge.
        adoptServerEntityId(cache, 'PantryItem', pantryItem.id, clientId);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Cache update failed for createPantryItem:',
        });
      }
    },
  });

  /**
   * Write the row, fire the create, and report what became of it. The row is
   * written PERMANENTLY before firing so it survives being queued offline; a
   * refusal withdraws it, count included.
   */
  const addItem = async (
    itemId: string,
    itemName: string,
  ): Promise<AddPantryItemOutcome> => {
    if (!pantryId) return { status: 'rejected' };

    const id = generateEntityId();
    // Publishing this id to `Pantry.itemsConnection` makes the row tappable,
    // and its detail/edit screens query by it. Hold those off until the server
    // has the row — see `unconfirmedCreates`.
    unconfirmedCreates.mark(id);

    try {
      // Publishes the row AND counts it, so the header cannot fall behind the
      // list offline, where no response arrives to correct it.
      writeLocalPantryItem(client.cache, id, { pantryId, itemName, itemId });
      addPantryItemLocally(client.cache, pantryId, {
        __typename: 'PantryItem',
        id,
      });
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Pantry Item (optimistic)',
      });
    }

    let result;
    let thrown: unknown;
    const today = todayKey();
    try {
      result = await createPantryItem({
        variables: {
          input: { id, pantryId, item: { id: itemId }, today },
          today,
        },
      });
    } catch (error) {
      thrown = error;
    }

    // A duplicate arrives as a typed member in `data` OR as the legacy
    // top-level code; reading one alone lets it fall through as success and
    // strands the row.
    const answered = result;
    const duplicate = answered
      ? getPantryItemDuplicateFromResult(
          answered.data?.createPantryItem,
          answered.error,
        )
      : null;

    let outcome: AddPantryItemOutcome = { status: 'added' };
    if (duplicate) {
      // The server writes nothing on a refusal, so withdraw what we published.
      revertOptimisticPantryItem(client.cache, pantryId, id);
      outcome = {
        status: 'duplicate',
        existingPantryItemId: duplicate.existingPantryItemId,
      };
    } else {
      // Keeps the row for a queued create and for IDEMPOTENT_REPLAY; the
      // caller tells the user about a refusal.
      const settled = await settleMutation(
        () => (answered ? Promise.resolve(answered) : Promise.reject(thrown)),
        {
          document: CreatePantryItemDocument,
          fallback: t('errors.addItemFailedRetry'),
          onFailed: () =>
            revertOptimisticPantryItem(client.cache, pantryId, id),
          present: 'none',
        },
      );
      if (settled.status === 'failed') outcome = { status: 'rejected' };
    }

    // Released on every outcome; a queued create is tracked by the offline
    // queue's pending set from here on.
    unconfirmedCreates.confirm(id);
    return outcome;
  };

  return { addItem };
}
