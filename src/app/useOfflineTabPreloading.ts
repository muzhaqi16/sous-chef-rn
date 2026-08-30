import { useEffect, useRef } from 'react';
import { useApolloClient } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { SortOrder } from '#/graphql/generated/schemaTypes';
import {
  useAppStore,
  useIsOnline,
  useIsPantryQueryComplete,
} from '#store/useAppStore';
import { errorService } from '#/services/errorService';

/**
 * Warms sibling tabs' queries into the cache. `HomeTabs` is lazy, so an
 * unvisited tab has nothing cached and is unusable offline — and the persisted
 * cache is purged on every version change. The tab stays unmounted; only data is
 * warmed, online-only and `cache-first`. Recipes is excluded (Spoonacular).
 */

/**
 * Variables MUST match the consuming hooks exactly, or the warm populates a
 * different cache entry and buys nothing.
 */
// One-shot `query` defaults to network-only, so `cache-first` must be explicit
// — otherwise every launch refetches what is already cached.
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
    name: 'GetShoppingListsLite',
    warm: client =>
      client.query({
        query: GetShoppingListsLiteDocument,
        variables: { first: 50 },
        ...WARM_OPTIONS,
      }),
  },
  {
    name: 'GetMealPlans',
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

async function warmTabQueries(client: ApolloClient): Promise<void> {
  for (const target of WARM_TARGETS) {
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

    const handle = requestIdleCallback(() => {
      warmTabQueries(client).catch(() => {
        warmedRef.current = false;
      });
    });

    return () => cancelIdleCallback(handle);
  }, [client, isOnline, isReady]);
}
