import { useApolloClient, useFragment, useQuery } from '@apollo/client/react';
import { GetMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useIsCreateUnconfirmed } from '#hooks/offline/useIsCreateUnconfirmed';
import {
  MealPlanMain_MealPlanFragmentDoc,
  type MealPlanMain_MealPlanFragment,
} from '#features/mealPlan/screens/MealPlanMain.generated';

export function useMealPlan(id: string | null) {
  const client = useApolloClient();

  // `createMealPlan` mints the cuid and writes the plan locally, so until the
  // create is acknowledged a server read returns null however honestly it
  // answers — and `planNotFound` would read that null as "deleted". Skipping is
  // what keeps the distinction sound, and makes the ack the fetch trigger.
  const isUnconfirmed = useIsCreateUnconfirmed(id);

  const { data, loading, error, refetch } = useQuery(GetMealPlanDocument, {
    variables: { id: id! },
    skip: !id || isUnconfirmed,
  });

  useApolloErrorLogger('GetMealPlan', error);

  // Live binding: `liveMealPlan.data` takes a fresh reference on every relevant
  // cache write, `mealPlanItems` membership included. Under `dataMasking` the
  // parent query's `data.mealPlan` is a masked ref whose identity is stable
  // across nested changes, so it cannot serve as that signal.
  const liveMealPlan = useFragment({
    fragment: MealPlanMain_MealPlanFragmentDoc,
    fragmentName: 'MealPlanMain_mealPlan',
    from: id ? { __typename: 'MealPlan', id } : null,
  });

  // Materializes the UNMASKED shape: `readFragment` returns `Unmasked<TData>`
  // where `useFragment` returns a masked one the screen would have to drill
  // `$fragmentRefs` for. Cache-key `from` form — the masked-ref form silently
  // returns partial data. The `liveMealPlan.data` guard is the load-bearing
  // dependency the compiler memoizes against; gating on the stable masked
  // `data.mealPlan` pins this read to a stale snapshot until a refetch.
  const mealPlan =
    id && liveMealPlan.complete && liveMealPlan.data
      ? client.cache.readFragment<MealPlanMain_MealPlanFragment>({
          fragment: MealPlanMain_MealPlanFragmentDoc,
          fragmentName: 'MealPlanMain_mealPlan',
          from: { __typename: 'MealPlan', id },
        }) ?? null
      : null;

  const items = mealPlan?.mealPlanItems ?? [];

  // The server answered with an explicit null for this id: there is no such
  // row. A by-id query reports a miss as null data, not as an error — only a
  // mutation raises RESOURCE_NOT_FOUND for the same condition. Gated on
  // `!loading && !error` so a request still in flight can't read as missing,
  // and on `data` so a skipped (unacknowledged create) query never does either.
  const planNotFound = !loading && !error && !!data && data.mealPlan === null;

  return {
    mealPlan,
    items,
    nutritionSummary: mealPlan?.nutritionSummary ?? null,
    mealPlanRef: data?.mealPlan ?? null,
    planNotFound,
    loading,
    error,
    refetch,
  };
}
