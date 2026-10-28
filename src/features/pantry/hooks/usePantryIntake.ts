import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  reconcileCreatedPantryItem,
  revertOptimisticPantryItem,
} from '#features/pantry/cache/items';
import type { LocalPantryItem } from '#features/pantry/cache/writeLocalPantryItem';
import {
  localIntakeRow,
  writeLocalIntake,
} from '#features/pantry/cache/localIntake';
import { readHeldStackUnit } from '#features/pantry/utils/pantryCacheReaders';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { adoptServerEntityId } from '#/apollo/utils/cacheUpdaters';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { generateEntityId } from '#/utils/generateEntityId';
import { todayKey } from '#/utils/dateUtils';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import type {
  CreatePantryItemInput,
  PantryItemSourceInput,
} from '#/graphql/generated/schemaTypes';

/**
 * A typed item goes under an id minted here, which the row names at once: the
 * server creates the item under it, or remembers it for the item it matched.
 */
const withMintedItemId = (item: PantryItemSourceInput): PantryItemSourceInput =>
  item.inline && !item.inline.id
    ? { inline: { ...item.inline, id: generateEntityId() } }
    : item;

/**
 * What became of an add. The caller owns the toast and the animation. An add
 * of a held product joins its stack or opens one of its own (USM-2), so it is
 * never refused as a duplicate.
 */
export type AddPantryItemOutcome =
  | { status: 'added' }
  /**
   * `reason` is the refusal as the user is told it; `field` names the input it
   * refused, when it named one.
   */
  | { status: 'rejected'; reason: string; field?: string };

interface AddItemOptions {
  /** What the row shows before the server answers, over what `input` states. */
  local?: Omit<LocalPantryItem, 'pantryId' | 'itemName'>;
  /** `'alert'` tells the user about a refusal here as well as in `reason`. */
  present?: 'alert' | 'none';
  /** The refusal copy when nothing more specific describes it. */
  fallback?: string;
}

/**
 * The pantry's one local-first create: the row is written before the mutation
 * fires, withdrawn on a refusal, and kept when the create is queued. Every add
 * is forced: the server joins a stack of the product it holds where the amount
 * converts on facts (`MERGED`), else opens one of its own (`CREATED`).
 */
export function usePantryIntake(pantryId: string | undefined) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [createPantryItem, { loading: adding }] = useMutation(
    CreatePantryItemDocument,
    {
      context: { localFirst: true },
      update: (cache, { data }, { variables }) => {
        const payload = appliedPayload(data);
        if (!payload || !pantryId) return;
        const pantryItem = payload.pantryItem;
        // Read outside the try: `?.` is a value block, and one inside a try
        // body bails the React Compiler out of the whole function.
        const clientId = variables?.input.id;
        const mintedItemId = variables?.input.item.inline?.id;

        try {
          reconcileCreatedPantryItem(cache, pantryId, pantryItem, clientId);
          // A typed item the API matched: the row names the one it holds.
          adoptServerEntityId(cache, 'Item', pantryItem.item.id, mintedItemId);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for createPantryItem:',
          });
        }
      },
    },
  );

  /**
   * Write the row, fire the create, and report what became of it. The row is
   * written PERMANENTLY before firing so it survives being queued offline; a
   * refusal withdraws it, count included.
   */
  const addItem = async (
    itemName: string,
    input: Omit<CreatePantryItemInput, 'id' | 'pantryId' | 'today'>,
    {
      local,
      present = 'none',
      fallback = t('errors.addItemFailedRetry'),
    }: AddItemOptions = {},
  ): Promise<AddPantryItemOutcome> => {
    if (!pantryId) {
      return { status: 'rejected', reason: fallback };
    }

    const id = generateEntityId();
    const sent = {
      ...input,
      item: withMintedItemId(input.item),
      forceAdd: true,
    };
    // Publishing this id to `Pantry.itemsConnection` makes the row tappable,
    // and its detail/edit screens query by it. Hold those off until the server
    // has the row — see `unconfirmedCreates`.
    unconfirmedCreates.mark(id);
    writeLocalIntake(
      client.cache,
      id,
      localIntakeRow(pantryId, itemName, sent, local),
    );

    let result;
    let thrown: unknown;
    const today = todayKey();
    try {
      result = await createPantryItem({
        variables: { input: { ...sent, id, pantryId, today }, today },
      });
    } catch (error) {
      thrown = error;
    }

    // Keeps the row for a queued create and for IDEMPOTENT_REPLAY. A refusal
    // naming a field reads as its localized `errors.field.*` copy.
    const answered = result;
    const settled = await settleMutation(
      () => (answered ? Promise.resolve(answered) : Promise.reject(thrown)),
      {
        document: CreatePantryItemDocument,
        fallback,
        onFailed: () => revertOptimisticPantryItem(client.cache, pantryId, id),
        present,
      },
    );
    let outcome: AddPantryItemOutcome = { status: 'added' };
    if (settled.status === 'failed') {
      const field = settled.failure?.field ?? undefined;
      outcome = {
        status: 'rejected',
        reason: settled.failure?.body ?? fallback,
        ...(field ? { field } : {}),
      };
    }

    // Released on every outcome; a queued create is tracked by the offline
    // queue's pending set from here on.
    unconfirmedCreates.confirm(id);
    return outcome;
  };

  /** The unit this pantry holds `itemId` in, a counted stack first; null if none. */
  const heldUnitOf = (itemId: string) =>
    readHeldStackUnit(client.cache, pantryId, itemId);

  return { addItem, adding, heldUnitOf };
}
