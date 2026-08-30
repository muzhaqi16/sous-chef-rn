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
 * Warms the sibling tabs' first-screen queries into the Apollo cache.
 *
 * `HomeTabs` sets `lazy: true`, which is correct — an offscreen tab should not
 * mount. But lazy mounting also means its query never runs, so a tab the user
 * has not visited while online has nothing cached and is unusable offline. On
 * device that showed as Pantry rendering 63 items with no network while
 * Shopping List said "Not available offline".
 *
 * Rendering and fetching are separate concerns: the tab stays unmounted and only
 * its data is warmed. Same gating as `useDataPreloading`, which does this for
 * autocomplete reference data — online only, after first-paint data has landed,
 * dispatched on the idle queue, and `cache-first` so a warm cache is a no-op.
 *
 * This matters more than it looks because the persisted cache is purged on every
 * app version change: without it, every update leaves the user with no offline
 * data for any tab until they visit each one online again.
 *
 * Recipes is deliberately excluded — its tab is backed by Spoonacular, not
 * Apollo, so there is no Apollo cache entry to warm.
 */

/**
 * Variables here MUST match the consuming hooks exactly or the warm populates a
 * different cache entry and buys nothing:
 *   - `useShoppingListsQuery`  -> GetShoppingListsLite { first: 50 }
 *   - `useMealPlans()` (no args, as MealPlanMain calls it) -> GetMealPlans
 */
// One-shot `query` defaults to network-only, so `cache-first` must be explicit
// — otherwise every launch refetches what is already cached.
const WARM_OPTIONS: { fetchPolicy: 'cache-first'; errorPolicy: 'all' } = {
  fetchPolicy: 'cache-first',
  errorPolicy: 'all',
};

/**
 * Each target owns its own call so the document and its variables stay paired.
 * They were a `{ document, variables }` array iterated in a loop, which unions
 * the operations together — under Apollo 4.2's modern signatures that pairing
 * is type-checked, and a union of documents no longer matches a union of
 * variables. Closing over both here is also what makes a mismatched pair a
 * compile error rather than a silently-warmed wrong cache entry.
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
