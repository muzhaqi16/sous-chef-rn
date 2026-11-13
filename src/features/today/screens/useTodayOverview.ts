import { useState } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { fromDateKey } from '#/utils/dateUtils';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { useToday } from '#hooks/app/useToday';
import type { StandDownOptions } from '#hooks/apollo/standDownOptions';
import { useDayConfirmedRead } from '#hooks/apollo/useDayConfirmedRead';
import { useDataState, type DataState } from '#hooks/data/useDataState';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useIsScreenFocused } from '#hooks/utils/useIsScreenFocused';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { useMealPlans } from '#features/mealPlan/hooks/useMealPlans';
import { useDailyMeals } from '#features/mealPlan/hooks/useDailyMeals';
import {
  useCurrentMealPlan,
  useMealPlan,
} from '#features/mealPlan/screens/useMealPlan';
import { useServerRecipeSuggestions } from '#features/recipes/hooks/useServerRecipeSuggestions';
import { toDisplayItems } from '#features/recipes/screens/recipeDisplayItems';
import { useShoppingListsLite } from '#features/shoppingList/hooks/useShoppingListsLite';
import { useActiveShoppingListId } from '#features/shoppingList/hooks/useActiveShoppingListId';
import { useUnreadNotificationCount } from '#features/notifications/hooks/useUnreadNotificationCount';
import { TodayCountsDocument } from './useTodayOverview.generated';

/** How many of Recipes' pantry suggestions Today previews. */
export const SUGGESTION_PREVIEW = 3;

/**
 * Today's overview of the household. Every read is another tab's, so each one
 * stands down while Today is hidden and answers from the cache on return.
 */
export function useTodayOverview() {
  const { t } = useTranslation();
  const isFocused = useIsScreenFocused();
  const standDown: StandDownOptions = {
    skip: !isFocused,
    fetchPolicy: 'cache-first',
  };
  const today = useToday();

  const { pantry, pantries, currentHome, selectedHomeId, homeCount, isReady } =
    useCurrentPantry();
  const unreadCount = useUnreadNotificationCount();
  // Only once the home itself has loaded: before that, no pantries means
  // nothing has arrived, not that there are none.
  const noPantry =
    !pantry &&
    isReady &&
    !!selectedHomeId &&
    !!currentHome &&
    pantries.length === 0;

  const countsRead = useDayConfirmedRead(
    pantry ? `${pantry.id}:${today}` : null,
    standDown.fetchPolicy,
  );
  const countsResult = useQuery(
    TodayCountsDocument,
    pantry && isFocused
      ? { variables: { id: pantry.id, today }, ...countsRead.policy }
      : skipToken,
  );
  // `skipToken` keeps the last run's data: a pantry since switched or deleted
  // has no counts to show here.
  const countsData =
    pantry && countsResult.variables.id === pantry.id
      ? countsResult.data
      : undefined;
  countsRead.markAnswered(
    countsData && !countsResult.loading && !countsResult.error
      ? `${countsResult.variables.id}:${countsResult.variables.today}`
      : null,
  );
  // A failed read answers `undefined`; the pantry's last counts for the day stand.
  const stats = usePreservedQueryData(
    countsData ? countsData.pantry?.stats ?? null : undefined,
    null,
    `${pantry?.id ?? ''}:${today}`,
  );

  // The plan covering today and its meals come with the list, not after it.
  const current = useCurrentMealPlan(standDown);
  const {
    state: {
      currentPlan,
      mealPlans,
      hasResult: plansHaveResult,
      initialLoading: plansLoading,
    },
    actions: { refetch: refetchPlans },
  } = useMealPlans({ ...standDown, current });
  // The plan covering today, not the one last opened on the Meal Plan tab.
  // While the server is naming it, its answer brings the plan: a list that
  // answers first must not read it again.
  const {
    items,
    itemDetails,
    mealPlan: activePlan,
    loading: activePlanLoading,
    error: activePlanError,
    refetch: refetchPlan,
  } = useMealPlan(currentPlan?.id ?? null, {
    ...standDown,
    skip: !isFocused || current.waiting,
  });
  // Meals the device does not hold are not the same as nothing planned.
  const mealsState = useDataState({
    // Before the first answer only: a refetch keeps the meals it shows.
    loading:
      plansLoading || current.waiting || (activePlanLoading && !activePlan),
    error: activePlanError,
    hasResult: !!activePlan,
    isEmpty: false,
    skipped: plansHaveResult && !currentPlan,
  });
  const { dailyMeals } = useDailyMeals(items, fromDateKey(today));
  const meals = dailyMeals.flatMap(group =>
    group.items.map(item => ({
      id: item.id,
      item,
      mealTypeLabel: group.label,
      recipeId:
        itemDetails.find(detail => detail.id === item.id)?.recipe?.id ?? null,
    })),
  );

  const suggestionsEnabled = useFeatureFlag('pantrySuggestions');
  const suggestions = useServerRecipeSuggestions(
    suggestionsEnabled && isFocused,
    { fetchPolicy: standDown.fetchPolicy },
  );

  const {
    lists,
    state: listsState,
    refetch: refetchLists,
  } = useShoppingListsLite(standDown);
  const [refreshing, setRefreshing] = useState(false);
  const activeListId = useActiveShoppingListId(lists);
  const activeList = lists.find(list => list.id === activeListId);

  const hasNoHousehold = isReady && !selectedHomeId && homeCount === 0;
  // No home and no answer for the list: the read failed, which is not "none".
  const homesUnanswered = isReady && !selectedHomeId && homeCount === null;
  const householdIsEmpty =
    (noPantry || stats?.totalItems === 0) &&
    plansHaveResult &&
    mealPlans.length === 0 &&
    listsState === 'empty';
  const isFirstRun = hasNoHousehold || householdIsEmpty;

  // Only the counts gate the screen: each other section shows when it arrives.
  // Until the pantry resolves there is nothing to ask, which is not an answer;
  // a home with no pantry has no counts to wait for.
  const countsState = useDataState({
    loading: countsResult.loading || (!pantry && !noPantry && !homesUnanswered),
    error: countsResult.error,
    hasResult: noPantry || stats !== null || countsData !== undefined,
    isEmpty: false,
  });
  const state: DataState = isFirstRun ? 'empty' : countsState;

  return {
    householdName: currentHome?.name ?? null,
    selectedHomeId,
    /** How many homes the user is in; null until the homes have loaded. */
    homeCount: isReady ? homeCount : null,
    unreadCount,
    counts: stats
      ? {
          expired: stats.expiredCount,
          expiring: stats.expiringCount,
          lowStock: stats.lowStockCount,
          /** Everything the pantry holds. */
          total: stats.totalItems,
        }
      : null,
    /** `empty` is the first run: no household, or one with nothing in it yet. */
    state,
    /** The first run starts by creating or joining a household. */
    needsHousehold: hasNoHousehold,
    retry: () => {
      if (pantry) void countsResult.refetch();
    },
    refreshing,
    /** Pull to refresh: every section asks again, and the spinner waits for all. */
    refresh: () => {
      void executeRefreshWithFinally(
        () =>
          Promise.allSettled([
            pantry ? countsResult.refetch() : null,
            refetchPlans(),
            activePlan ? refetchPlan() : null,
            refetchLists(),
            suggestions.refresh(),
          ]),
        setRefreshing,
      );
    },
    meals,
    mealsState,
    retryMeals: () => {
      void refetchPlans();
      if (currentPlan) void refetchPlan();
    },
    suggestions: {
      items: suggestionsEnabled
        ? toDisplayItems(suggestions.rows.slice(0, SUGGESTION_PREVIEW), t)
        : [],
      /** Asked and not yet answered: the section holds its rows' place. */
      loading: suggestions.loading,
      /** Until they answer, whether the pantry holds anything decides. */
      fromPantry: suggestions.loading
        ? (stats?.totalItems ?? 0) > 0
        : suggestions.fromPantry,
    },
    shopping: activeList
      ? {
          id: activeList.id,
          name: activeList.name,
          itemsLeft: Math.max(
            activeList.totalItems - activeList.completedItems,
            0,
          ),
        }
      : null,
  };
}
