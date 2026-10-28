import { useEffect, useRef } from 'react';
import { useApolloClient } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { SHOPPING_LISTS_PAGE_SIZE } from '#features/shoppingList/hooks/useShoppingListsQuery';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import { pantryQueryVariables } from '#features/pantry/hooks/usePantryQuery';
import { todayKey } from '#/utils/dateUtils';
import { useStore } from '#store';
import { SortOrder } from '#/graphql/generated/schemaTypes';
import { scheduleIdle } from '#/utils/scheduleIdle';
import {
  useAppStore,
  useIsOnline,
  useIsPantryQueryComplete,
} from '#store/useAppStore';
import { errorService } from '#/services/errorService';
import { operationNameOf } from '#/apollo/utils/documentOperation';

/**
 * Warms sibling tabs' queries into the cache. `HomeTabs` is lazy, so an
 * unvisited tab has nothing cached and is unusable offline — and the persisted
 * cache is purged on every version change. The tab stays unmounted; only data is
 * warmed, online-only and `cache-first`. Pantry is warmed too: Today, not
 * Pantry, is the tab a launch mounts. Recipes is excluded: its discovery's
 * variables come from the pantry and the dietary profile as they load.
 */

/**
 * Variables MUST match the consuming hooks exactly, or the warm populates a
 * different cache entry and buys nothing.
 */
// Stated rather than defaulted: a warm that refetched what is already cached
// would cost a launch what it exists to save.
const WARM_OPTIONS: { fetchPolicy: 'cache-first'; errorPolicy: 'all' } = {
  fetchPolicy: 'cache-first',
  errorPolicy: 'all',
};

/**
 * Each target owns its own call so the document and its variables stay paired.
 * Iterating a `{ document, variables }` array unions the operations, and under
 * Apollo's modern signatures a union of documents does not match a union of
 * variables — so a mismatched pair is a compile error here, not a wrong warm.
 */
const WARM_TARGETS: Array<{
  name: string;
  warm: (client: ApolloClient) => Promise<unknown>;
}> = [
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
        variables: { first: SHOPPING_LISTS_PAGE_SIZE },
        ...WARM_OPTIONS,
      }),
  },
  {
    name: operationNameOf(GetMealPlansDocument),
    warm: client =>
      client.query({
        query: GetMealPlansDocument,
        variables: {
          first: 20,
          filters: undefined,
          orderBy: { startDate: SortOrder.Desc },
        },
        ...WARM_OPTIONS,
      }),
  },
];

async function warmOne(
  client: ApolloClient,
  target: (typeof WARM_TARGETS)[number],
): Promise<void> {
  // Plain statements only inside the try: a value block (`?.`, `??`, ternary)
  // there bails the whole function out of the React Compiler.
  try {
    await target.warm(client);
  } catch (error) {
    // Best effort: a failed warm must never surface to the user or block
    // anything. The next cold start retries.
    errorService.reportError(error, {
      operation: `Offline tab warm: ${target.name}`,
    });
  }
}

// Together, so a cold cache costs one round trip rather than three.
async function warmTabQueries(client: ApolloClient): Promise<void> {
  await Promise.all(WARM_TARGETS.map(target => warmOne(client, target)));
}

export function useOfflineTabPreloading(): void {
  const client = useApolloClient();
  const isOnline = useIsOnline();
  const hasInitializedHomeData = useAppStore(
    state => state.hasInitializedHomeData,
  );
  const isPantryQueryComplete = useIsPantryQueryComplete();
  const isReady = hasInitializedHomeData || isPantryQueryComplete;

  // Once per session. A failure leaves this false so the next online tick can
  // retry, matching how `useDataPreloading` leaves its timestamp null.
  const warmedRef = useRef(false);

  useEffect(() => {
    if (!isOnline || !isReady || warmedRef.current) return;
    warmedRef.current = true;

    return scheduleIdle(() => {
      warmTabQueries(client).catch(() => {
        warmedRef.current = false;
      });
    });
  }, [client, isOnline, isReady]);
}
