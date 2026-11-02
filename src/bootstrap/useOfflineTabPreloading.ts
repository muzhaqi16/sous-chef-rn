import { useEffect, useRef } from 'react';
import { useApolloClient } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
import {
  GetShoppingListDetailsDocument,
  GetShoppingListItemsFilteredDocument,
  GetShoppingListsLiteDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { SHOPPING_LISTS_PAGE_SIZE } from '#features/shoppingList/hooks/useShoppingListsQuery';
import { activeShoppingListId } from '#features/shoppingList/hooks/useActiveShoppingListId';
import { PAGINATION } from '#features/shoppingList/utils/shoppingListConstants';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { UNFILTERED_PLANS_VARIABLES } from '#features/mealPlan/hooks/useMealPlans';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import { pantryQueryVariables } from '#features/pantry/hooks/usePantryQuery';
import { todayKey } from '#/utils/dateUtils';
import { useStore } from '#store';
import { scheduleIdle } from '#/utils/scheduleIdle';
import { useAppStore, useIsPantryQueryComplete } from '#store/useAppStore';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { errorService } from '#/services/errorService';
import { operationNameOf } from '#/apollo/utils/documentOperation';

/**
 * Warms sibling tabs' queries into the cache. `HomeTabs` is lazy, so an
 * unvisited tab has nothing cached and is unusable offline — and a shape change
 * purges the persisted cache. The tab stays unmounted; only data is warmed,
 * online-only and `cache-first`. Pantry is warmed too: Today, not Pantry, is the
 * tab a launch mounts. Recipes is excluded: its discovery's variables come from
 * the pantry and the dietary profile as they load. Once the lists land, what
 * they name follows: the active shopping list, and what the host adds, whose
 * screens own the reads the core cannot name.
 */

/**
 * Variables MUST match the consuming hooks exactly, or the warm populates a
 * different cache entry and buys nothing.
 */
// Stated rather than defaulted: a warm that refetched what is already cached
// would cost a launch what it exists to save, and only `errorPolicy: 'none'`
// rejects a failed read, which is how a warm learns to run again.
const WARM_OPTIONS: { fetchPolicy: 'cache-first'; errorPolicy: 'none' } = {
  fetchPolicy: 'cache-first',
  errorPolicy: 'none',
};

const LISTS_VARIABLES = { first: SHOPPING_LISTS_PAGE_SIZE };

export interface WarmTarget {
  name: string;
  warm: (client: ApolloClient) => Promise<unknown>;
}

/**
 * Each target owns its own call so the document and its variables stay paired.
 * Iterating a `{ document, variables }` array unions the operations, and under
 * Apollo's modern signatures a union of documents does not match a union of
 * variables — so a mismatched pair is a compile error here, not a wrong warm.
 */
const WARM_TARGETS: WarmTarget[] = [
  {
    name: operationNameOf(GetPantryDocument),
    // The Pantry screen's client-mode read; a pantry over `PAGE_SIZE.MAX`
    // reads filtered pages the warm cannot know.
    warm: client => {
      const pantryId = useStore.getState().selectedPantryId;
      if (!pantryId) return Promise.resolve();
      return client.query({
        query: GetPantryDocument,
        variables: pantryQueryVariables(pantryId, todayKey()),
        ...WARM_OPTIONS,
      });
    },
  },
  {
    name: operationNameOf(GetShoppingListsLiteDocument),
    warm: client =>
      client.query({
        query: GetShoppingListsLiteDocument,
        variables: LISTS_VARIABLES,
        ...WARM_OPTIONS,
      }),
  },
  {
    name: operationNameOf(GetMealPlansDocument),
    warm: client =>
      client.query({
        query: GetMealPlansDocument,
        variables: UNFILTERED_PLANS_VARIABLES,
        ...WARM_OPTIONS,
      }),
  },
];

/** The list the user works in, with both tabs of its items. */
async function warmActiveList(client: ApolloClient): Promise<void> {
  const held = client.cache.readQuery({
    query: GetShoppingListsLiteDocument,
    variables: LISTS_VARIABLES,
    optimistic: false,
  });
  const id = activeShoppingListId(
    held?.shoppingLists.edges.map(edge => edge.node) ?? [],
    useStore.getState().selectedShoppingListId,
  );
  if (!id) return;
  await Promise.all([
    client.query({
      query: GetShoppingListDetailsDocument,
      variables: { id },
      ...WARM_OPTIONS,
    }),
    ...[false, true].map(isPurchased =>
      client.query({
        query: GetShoppingListItemsFilteredDocument,
        variables: { id, first: PAGINATION.ITEMS_PAGE_SIZE, isPurchased },
        ...WARM_OPTIONS,
      }),
    ),
  ]);
}

const ACTIVE_LIST_TARGET: WarmTarget = {
  name: operationNameOf(GetShoppingListItemsFilteredDocument),
  warm: warmActiveList,
};

/** Whether the target landed. A failure never surfaces to the user. */
async function warmOne(
  client: ApolloClient,
  target: WarmTarget,
): Promise<boolean> {
  // Plain statements only inside the try: a value block (`?.`, `??`, ternary)
  // there bails the whole function out of the React Compiler.
  try {
    await target.warm(client);
    return true;
  } catch (error) {
    errorService.reportError(error, {
      operation: `Offline tab warm: ${target.name}`,
    });
    return false;
  }
}

// Together, so a cold cache costs one round trip rather than three. What the
// lists name reads what they landed, so it runs after them.
async function warmTabQueries(
  client: ApolloClient,
  hostTargets: readonly WarmTarget[],
): Promise<boolean> {
  const tabs = await Promise.all(
    WARM_TARGETS.map(target => warmOne(client, target)),
  );
  const named = await Promise.all(
    [ACTIVE_LIST_TARGET, ...hostTargets].map(target => warmOne(client, target)),
  );
  return [...tabs, ...named].every(Boolean);
}

const NO_HOST_TARGETS: readonly WarmTarget[] = [];

export function useOfflineTabPreloading(
  hostTargets: readonly WarmTarget[] = NO_HOST_TARGETS,
): void {
  const client = useApolloClient();
  const isOffline = useIsApiUnavailable();
  const hasInitializedHomeData = useAppStore(
    state => state.hasInitializedHomeData,
  );
  const isPantryQueryComplete = useIsPantryQueryComplete();
  const isReady = hasInitializedHomeData || isPantryQueryComplete;

  // Once per session. True while a warm runs, and a failure leaves it false, so
  // the next time the API comes back retries what did not land.
  const warmedRef = useRef(false);

  useEffect(() => {
    if (isOffline || !isReady || warmedRef.current) return;

    return scheduleIdle(() => {
      warmedRef.current = true;
      void warmTabQueries(client, hostTargets).then(landed => {
        warmedRef.current = landed;
      });
    });
  }, [client, hostTargets, isOffline, isReady]);
}
