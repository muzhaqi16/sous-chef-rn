import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  RestockPantryItemDocument,
  GetPantryDocument,
  GetPantryItemSuggestionsDocument,
  type GetPantryQuery,
  type GetPantryItemSuggestionsQuery,
} from '#features/pantry/graphql/pantry.generated';
import { addToPantryItemsCache } from '#features/pantry/cache/items';
import { findCachedPantryItemDuplicate } from '#features/pantry/utils/pantryCacheReaders';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { writeEntityFields } from '#/apollo/utils/localFirstFields';
import { extractNodes } from '#/utils/connectionUtils';
import { generateEntityId } from '#/utils/generateEntityId';
import { todayKey } from '#/utils/dateUtils';
import { useTranslation } from '#/i18n';
import { writeHeldStock } from '#features/pantry/cache/stock';

export type RestockOutcome = { status: 'restocked' } | { status: 'rejected' };

interface UseAddToPantryArgs {
  pantryId: string | undefined;
  suggestionsLimit: number;
}

/**
 * Every cache write and mutation the add-to-pantry sheet performs. What the
 * sheet keeps is the toast, the exit animation and the in-flight set; the
 * create itself is `usePantryIntake`, so the sheet's two entry points cannot
 * drift apart.
 */
export function useAddToPantry({
  pantryId,
  suggestionsLimit,
}: UseAddToPantryArgs) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const intake = usePantryIntake(pantryId);

  const [restockPantryItem] = useMutation(RestockPantryItemDocument, {
    context: { localFirst: true },
    update: (cache, { data }) => {
      const payload = appliedPayload(data);
      if (!payload || !pantryId) return;
      const pantryItem = payload.pantryItemUsage.pantryItem;
      if (!pantryItem) return;
      // Forces the connection to broadcast: the row already exists, so the
      // re-add returns the connection unchanged, but `cache.modify` still makes
      // query watchers re-emit.
      addToPantryItemsCache(cache, pantryId, pantryItem);
    },
  });

  /** Drop a suggestion from every list it appears in, synchronously. */
  const removeSuggestion = (itemId: string) => {
    if (!pantryId) return;
    client.cache.updateQuery<GetPantryItemSuggestionsQuery>(
      {
        query: GetPantryItemSuggestionsDocument,
        variables: { pantryId, limit: suggestionsLimit },
      },
      data => {
        if (!data?.pantry) return data;
        const { pantry } = data;
        const sections = pantry.suggestions;
        const without = <T extends { itemId: string }>(list: readonly T[]) =>
          list.filter(s => s.itemId !== itemId);
        return {
          ...data,
          pantry: {
            ...pantry,
            suggestions: {
              ...sections,
              lowStock: without(sections.lowStock),
              expiringSoon: without(sections.expiringSoon),
              recentlyDeleted: without(sections.recentlyDeleted),
              frequentlyAdded: without(sections.frequentlyAdded),
              popular: without(sections.popular),
            },
          },
        };
      },
    );
  };

  /** The pantry's storage locations, read once from cache with no watcher. */
  const readStorageLocations = () => {
    const cached = client.readQuery<GetPantryQuery>({
      query: GetPantryDocument,
      variables: { id: pantryId ?? '' },
    });
    return extractNodes(cached?.pantry?.storageLocationsConnection);
  };

  /**
   * Does this pantry already stock the item in the unit the add would create,
   * as far as the cache knows? An unknown unit is the server's to resolve.
   */
  const findCachedDuplicate = (
    itemId: string,
    unitId: string | null | undefined,
  ) =>
    pantryId && unitId
      ? findCachedPantryItemDuplicate(client.cache, pantryId, {
          itemId,
          unitId,
        })
      : null;

  /**
   * Bump the row's quantity locally, then restock it — offline the mutation's
   * `update` never runs. A null `cachedQuantity` skips the bump, for a
   * duplicate the server named: that reaches us only online.
   */
  const restockItem = async (
    pantryItemId: string,
    cachedQuantity: number | null,
  ): Promise<RestockOutcome> => {
    const entity =
      cachedQuantity === null
        ? undefined
        : { __typename: 'PantryItem', id: pantryItemId };
    writeEntityFields(client.cache, entity, {
      quantity: (cachedQuantity ?? 0) + 1,
    });
    // The amount the screens show moves with the count.
    const undoHeld =
      cachedQuantity === null
        ? () => {}
        : writeHeldStock(client.cache, pantryItemId, held => held + 1);

    // The sheet tells the user; the settle classifies, reverts and reports.
    const today = todayKey();
    const settled = await settleMutation(
      () =>
        restockPantryItem({
          variables: {
            today,
            input: {
              id: pantryItemId,
              amount: { measured: { quantity: 1 } },
              // Dedupes the restock ledger row on replay.
              idempotencyKey: generateEntityId(),
              today,
            },
          },
        }),
      {
        document: RestockPantryItemDocument,
        fallback: t('addToPantry.restockFailed'),
        onFailed: () => {
          writeEntityFields(client.cache, entity, {
            quantity: cachedQuantity ?? undefined,
          });
          undoHeld();
        },
        present: 'none',
      },
    );
    if (settled.status === 'failed') return { status: 'rejected' };
    return { status: 'restocked' };
  };

  /** The sheet adds a catalog item as-is: the server fills quantity and unit. */
  const addItem = (itemId: string, itemName: string) =>
    intake.addItem(itemName, { item: { id: itemId } });

  return {
    addItem,
    restockItem,
    removeSuggestion,
    readStorageLocations,
    findCachedDuplicate,
  };
}
