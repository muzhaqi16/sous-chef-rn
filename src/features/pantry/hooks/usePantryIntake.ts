import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  addPantryItemLocally,
  reconcileCreatedPantryItem,
  revertOptimisticPantryItem,
} from '#features/pantry/cache/items';
import {
  writeLocalPantryItem,
  type LocalPantryItem,
} from '#features/pantry/cache/writeLocalPantryItem';
import { readHeldStackUnit } from '#features/pantry/utils/pantryCacheReaders';
import { getPantryItemDuplicateFromResult } from '#domain/pantryItemDuplicate';
import { localQuantity } from '#domain/stockAmount';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { generateEntityId } from '#/utils/generateEntityId';
import { todayKey } from '#/utils/dateUtils';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import type { CreatePantryItemInput } from '#/graphql/generated/schemaTypes';

/** What became of an add. The caller owns the toast and the animation. */
export type AddPantryItemOutcome =
  | { status: 'added' }
  | { status: 'duplicate'; existingPantryItemId: string }
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
 * fires, withdrawn on a refusal or a duplicate, and kept when the create is
 * queued. The add sheet and its details form, onboarding's picker, a barcode
 * scan and a receipt's apply all use it.
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

        try {
          reconcileCreatedPantryItem(cache, pantryId, pantryItem, clientId);
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
    // Publishing this id to `Pantry.itemsConnection` makes the row tappable,
    // and its detail/edit screens query by it. Hold those off until the server
    // has the row — see `unconfirmedCreates`.
    unconfirmedCreates.mark(id);
    // Built outside the try: a value block inside a try body bails the compiler.
    const localRow: LocalPantryItem = {
      pantryId,
      itemName,
      itemId: input.item.id ?? null,
      quantity:
        input.quantity ??
        (input.amount ? localQuantity(input.amount, {}) : undefined),
      unitId:
        input.unit?.id ??
        input.amount?.measured?.unitId ??
        input.amount?.packages?.unitId,
      storageState: input.storage?.storageState,
      acquisitionMethod: input.purchase?.acquisitionMethod,
      ...local,
    };

    try {
      // Publishes the row AND counts it, so the header cannot fall behind the
      // list offline, where no response arrives to correct it.
      writeLocalPantryItem(client.cache, id, localRow);
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
        variables: { input: { ...input, id, pantryId, today }, today },
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
      // Keeps the row for a queued create and for IDEMPOTENT_REPLAY. A refusal
      // naming a field reads as its localized `errors.field.*` copy.
      const settled = await settleMutation(
        () => (answered ? Promise.resolve(answered) : Promise.reject(thrown)),
        {
          document: CreatePantryItemDocument,
          fallback,
          onFailed: () =>
            revertOptimisticPantryItem(client.cache, pantryId, id),
          present,
        },
      );
      if (settled.status === 'failed') {
        const field = settled.failure?.field ?? undefined;
        outcome = {
          status: 'rejected',
          reason: settled.failure?.body ?? fallback,
          ...(field ? { field } : {}),
        };
      }
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
