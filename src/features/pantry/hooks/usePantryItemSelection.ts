import {
  skipToken,
  useApolloClient,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import {
  GetPantryDocument,
  CreatePantryItemDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import {
  UsePantryItemSelection_PantryItemFragmentDoc,
  type UsePantryItemSelection_PantryItemFragment,
} from './usePantryItemSelection.generated';
import {
  addPantryItemLocally,
  addToPantryItemsCache,
  revertOptimisticPantryItem,
} from '#features/pantry/cache/items';
import { buildOptimisticPantryItem } from '#features/pantry/hooks/buildOptimisticPantryItem';
import { writePantryItemDetailStub } from '#features/pantry/hooks/writePantryItemDetailStub';
import { usePantryItemMutations } from '#features/pantry/hooks/mutations/usePantryItemMutations';
import type { AddPantryItemOutcome } from '#features/pantry/hooks/mutations/useAddToPantry';
import { getPantryItemDuplicateFromResult } from '#domain/pantryItemDuplicate';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { adoptServerEntityId } from '#/apollo/utils/cacheUpdaters';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { extractNodes } from '#/utils/connectionUtils';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import type { CreatePantryItemInput } from '#/graphql/generated/schemaTypes';
import { useToday } from '#hooks/useToday';

type PantryItemsConnection = NonNullable<
  GetPantryQuery['pantry']
>['itemsConnection'];

interface ExistingPantryIndex {
  /** catalog id -> the pantry row's id */
  existingItemMap: Map<string, string>;
  existingCatalogIds: Set<string>;
}

// Keyed by the connection object, which Apollo replaces whenever the underlying
// rows change, so a hit cannot go stale.
const indexCache = new WeakMap<object, ExistingPantryIndex>();

/**
 * Each row is a masked ref, so resolving costs one cache read apiece. The React
 * Compiler leaves this derivation uncached in a component body, so it is cached
 * explicitly against the connection identity.
 */
function buildIndex(
  cache: ApolloCache,
  itemsConnection: PantryItemsConnection | undefined,
): ExistingPantryIndex {
  if (!itemsConnection) {
    return { existingItemMap: new Map(), existingCatalogIds: new Set() };
  }
  const cached = indexCache.get(itemsConnection);
  if (cached) return cached;

  const existingItemMap = new Map<string, string>();
  const existingCatalogIds = new Set<string>();
  for (const ref of extractNodes(itemsConnection)) {
    const pantryItem =
      cache.readFragment<UsePantryItemSelection_PantryItemFragment>({
        fragment: UsePantryItemSelection_PantryItemFragmentDoc,
        fragmentName: 'usePantryItemSelection_pantryItem',
        from: ref,
      });
    if (!pantryItem) continue;
    const catalogId = pantryItem.item.id;
    if (catalogId) {
      existingItemMap.set(catalogId, pantryItem.id);
      existingCatalogIds.add(catalogId);
    }
  }
  const index = { existingItemMap, existingCatalogIds };
  indexCache.set(itemsConnection, index);
  return index;
}

/**
 * Which catalog items a pantry already holds, and the two writes that change
 * that. Public because onboarding's picker needs it before any pantry screen
 * has mounted, and both the pantry's documents and the shape of its item rows
 * are the pantry feature's to know.
 */
export function usePantryItemSelection(pantryId: string | null | undefined) {
  const today = useToday();
  const { t } = useTranslation();
  const client = useApolloClient();
  const { data, loading, refetch } = useQuery(
    GetPantryDocument,
    pantryId
      ? {
          variables: {
            id: pantryId,
            itemsFirst: 100,
            today,
          },
        }
      : skipToken,
  );

  const { removeItem } = usePantryItemMutations({
    pantryId: pantryId ?? undefined,
    refetch: () => {
      void refetch();
    },
  });

  const [createPantryItem] = useMutation(CreatePantryItemDocument, {
    update: (cache, { data: result }, { variables }) => {
      const payload = appliedPayload(result);
      if (!payload || !pantryId) return;
      // Read outside the try: a value block inside a try body bails the compiler.
      const clientId = variables?.input.id;
      try {
        // Reconciles the server entity into the edge the eager write counted.
        addToPantryItemsCache(cache, pantryId, payload.pantryItem);
        adoptServerEntityId(
          cache,
          'PantryItem',
          payload.pantryItem.id,
          clientId,
        );
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Cache update failed for createPantryItem:',
        });
      }
    },
  });

  const { existingItemMap, existingCatalogIds } = buildIndex(
    client.cache,
    data?.pantry?.itemsConnection,
  );

  /**
   * The row is written and counted before firing, so a queued create shows at
   * once; a refusal or a duplicate withdraws it.
   */
  const addItem = async (
    itemName: string,
    input: Omit<CreatePantryItemInput, 'id' | 'pantryId'>,
  ): Promise<AddPantryItemOutcome> => {
    if (!pantryId) return { status: 'rejected' };

    const id = generateEntityId();
    // The published id is tappable; detail screens wait until the server has it.
    unconfirmedCreates.mark(id);
    const itemId = input.item.id ?? null;
    // Built outside the try: a value block inside a try body bails the compiler.
    const optimistic = buildOptimisticPantryItem(
      id,
      {
        pantryId,
        itemName,
        itemId,
        quantity: input.quantity,
        unitId: input.unit?.id,
        storageState: input.storage?.storageState,
      },
      client.cache,
    );

    try {
      addPantryItemLocally(client.cache, pantryId, optimistic);
      writePantryItemDetailStub(client.cache, id, { itemId, itemName });
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Pantry Item (optimistic)',
      });
    }

    let result;
    let thrown: unknown;
    try {
      result = await createPantryItem({
        variables: { input: { ...input, id, pantryId, today }, today },
        context: { localFirst: true },
      });
    } catch (error) {
      thrown = error;
    }

    // A duplicate arrives as a typed member in `data` OR as a top-level code.
    const answered = result;
    const duplicate = answered
      ? getPantryItemDuplicateFromResult(
          answered.data?.createPantryItem,
          answered.error,
        )
      : null;

    let outcome: AddPantryItemOutcome = { status: 'added' };
    if (duplicate) {
      revertOptimisticPantryItem(client.cache, pantryId, id);
      outcome = {
        status: 'duplicate',
        existingPantryItemId: duplicate.existingPantryItemId,
      };
    } else {
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

    // A queued create is tracked by the offline queue's pending set from here.
    unconfirmedCreates.confirm(id);
    return outcome;
  };

  return {
    existingItemMap,
    existingCatalogIds,
    loading,
    /**
     * Whether the pantry read has anything to show. `cache-and-network` reports
     * `loading: true` on EVERY mount whatever the cache holds, so a caller that
     * gates on `loading` alone blanks the screen on every revisit.
     */
    hasLoaded: !!data?.pantry,
    addItem,
    /** Local-first: the row leaves the cache before the delete fires. */
    removeItem,
  };
}
