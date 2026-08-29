import { useApolloClient, useFragment, useQuery } from '@apollo/client/react';
import { GetMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import {
  MealPlanMain_MealPlanFragmentDoc,
  type MealPlanMain_MealPlanFragment,
} from '#features/mealPlan/screens/MealPlanMain.generated';

export function useMealPlan(id: string | null) {
  const client = useApolloClient();

  const { data, loading, error, refetch } = useQuery(GetMealPlanDocument, {
    variables: { id: id! },
    skip: !id,
  });

  useApolloErrorLogger('GetMealPlan', error);

  // Live binding to the MealPlan entity. `liveMealPlan.data` gets a fresh
  // reference whenever the MealPlan's selected fields change in the cache —
  // including `mealPlanItems` membership when an item is added or removed.
  // Under `dataMasking: true` the parent useQuery's `data.mealPlan` is a
  // masked ref whose identity is stable when only deeply-nested fragment-spread
  // fields change, so it cannot serve as that reactivity signal.
  const liveMealPlan = useFragment({
    fragment: MealPlanMain_MealPlanFragmentDoc,
    fragmentName: 'MealPlanMain_mealPlan',
    from: id ? { __typename: 'MealPlan', id } : null,
  });

  // Materialize the unmasked MealPlanMain_mealPlan shape (cache.readFragment
  // returns `Unmasked<TData>`; useFragment returns `MaybeMasked<TData>`, which
  // would force the screen to drill into `$fragmentRefs` to read
  // item.id/date/etc.). Cache-key `from` form — the masked-ref form silently
  // returns partial/null data under dataMasking. The settings sheet does its
  // own useFragment on the ref passed down to it.
  //
  // `readFragment` reads the mutable cache during render, so the React Compiler
  // memoizes this derivation against the reactive values referenced here. The
  // `liveMealPlan.data` guard is the load-bearing dependency: because
  // useQuery's masked `data.mealPlan` ref is stable across mealPlanItems
  // add/remove, gating only on `data.mealPlan` would pin this read to a stale
  // snapshot until a refetch produced a new reference — added items wouldn't
  // appear and deleted items wouldn't disappear until pull-to-refresh.
  // Referencing `liveMealPlan.data` (fresh on every relevant cache write)
  // forces the unmasked read to re-run immediately.
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
