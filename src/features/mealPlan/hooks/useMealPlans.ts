import { useApolloClient, useFragment, useQuery } from '@apollo/client/react';
import { startOfDay } from 'date-fns';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import {
  SortOrder,
  type MealPlanFilters,
} from '#/graphql/generated/schemaTypes';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import {
  MealPlanDisplayFragmentDoc,
  type MealPlanDisplayFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import {
  isPlanActiveAt,
  resolveCurrentMealPlan,
} from '#features/mealPlan/utils/mealPlanFilters';

/** `useOfflineTabPreloading` warms the unfiltered list with these variables. */
const PAGE_SIZE = 20;

/** Plans overlapping today, nearest first: a handful covers every real case. */
const CURRENT_PLAN_PAGE_SIZE = 3;

interface MealPlanListOptions {
  skip?: boolean;
  orderBy?: SortOrder;
  first?: number;
}

/** One cursor-paged `mealPlans` variant, materialized as display plans. */
export function useMealPlanList(
  filters: MealPlanFilters | undefined,
  {
    skip = false,
    orderBy = SortOrder.Desc,
    first = PAGE_SIZE,
  }: MealPlanListOptions = {},
) {
  const isLoggedOut = useIsLoggedOut();
  const client = useApolloClient();

  const { data, loading, error, refetch, fetchMore } = useQuery(
    GetMealPlansDocument,
    {
      variables: {
        first,
        filters,
        orderBy: { startDate: orderBy },
      },
      skip: isLoggedOut || skip,
    },
  );

  useApolloErrorLogger(GetMealPlansDocument, error);

  const connectionData = useConnectionData({
    data,
    selector: d => d.mealPlans,
    loading,
    fetchMore,
    refetch,
  });

  // Edges arrive as masked refs. The cache-key `from` materializes the full
  // display shape; the masked-ref `from` silently returns partial/null data.
  const mealPlans = connectionData.items
    .map(ref =>
      client.cache.readFragment<MealPlanDisplayFragment>({
        fragment: MealPlanDisplayFragmentDoc,
        fragmentName: 'MealPlanDisplay',
        from: { __typename: 'MealPlan', id: ref.id },
      }),
    )
    .filter((p): p is MealPlanDisplayFragment => p !== null);

  return {
    mealPlans,
    loading,
    error,
    refetch: async () => {
      await refetch();
    },
    hasResult: data !== undefined,
    skipped: isLoggedOut,
    hasMore: connectionData.hasMore,
    loadingMore: connectionData.isLoadingMore,
    loadMore: connectionData.loadMore,
  };
}

/** A plan's list-card shape from the cache, whichever page or query loaded it. */
export function useMealPlanDisplay(
  planId: string | null,
): MealPlanDisplayFragment | null {
  const { data, complete } = useFragment({
    fragment: MealPlanDisplayFragmentDoc,
    fragmentName: 'MealPlanDisplay',
    from: planId ? { __typename: 'MealPlan', id: planId } : null,
  });
  return planId && complete ? data : null;
}

export function useMealPlans() {
  const list = useMealPlanList(undefined);

  // `filters.startDate` keeps plans ending today or later; ascending, started
  // plans lead and the nearest upcoming follows, so the current plan is on page
  // one unless a full page of plans overlaps today.
  // Skipped only when the list's page holds a plan ACTIVE today: that beats any
  // upcoming one. A merely upcoming plan on page one may not be the nearest.
  const now = new Date();
  const listActive = list.mealPlans.some(plan => isPlanActiveAt(plan, now));
  const todayStart = startOfDay(now).toISOString();
  const current = useMealPlanList(
    { startDate: todayStart },
    {
      orderBy: SortOrder.Asc,
      first: CURRENT_PLAN_PAGE_SIZE,
      skip: listActive,
    },
  );

  // The list takes part too: offline, a new day's variant has no cached page.
  const currentPlan =
    resolveCurrentMealPlan([...current.mealPlans, ...list.mealPlans], now) ??
    list.mealPlans[0] ??
    null;

  return {
    state: {
      mealPlans: list.mealPlans,
      currentPlan,
      loading: list.loading,
      // True only while the very first response is in flight, so a
      // `cache-and-network` refetch over rendered content never flashes a skeleton.
      initialLoading: list.loading && !list.hasResult,
      error: list.error,
      // A response arrived, empty or not: "you have no plans" vs "no answer".
      hasResult: list.hasResult,
      // Signed out, so no query was sent: the screen shows its empty state.
      skipped: list.skipped,
      hasMore: list.hasMore,
      loadingMore: list.loadingMore,
    },
    actions: {
      refetch: list.refetch,
      loadMore: list.loadMore,
    },
  };
}
