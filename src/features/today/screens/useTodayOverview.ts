import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { fromDateKey } from '#/utils/dateUtils';
import { useToday } from '#hooks/app/useToday';
import {
  heldFetchPolicy,
  type StandDownOptions,
} from '#hooks/apollo/standDownOptions';
import { useDataState, type DataState } from '#hooks/data/useDataState';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useIsScreenFocused } from '#hooks/utils/useIsScreenFocused';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { useMealPlans } from '#features/mealPlan/hooks/useMealPlans';
import { useDailyMeals } from '#features/mealPlan/hooks/useDailyMeals';
import { useActiveMealPlan } from '#features/mealPlan/screens/useActiveMealPlan';
import { useServerRecipeSuggestions } from '#features/recipes/hooks/useServerRecipeSuggestions';
import { toDisplayItems } from '#features/recipes/screens/recipeDisplayItems';
import { useShoppingListsLite } from '#features/shoppingList/hooks/useShoppingListsLite';
import { useActiveShoppingListId } from '#features/shoppingList/hooks/useActiveShoppingListId';
import { useUnreadNotificationCount } from '#features/notifications/hooks/useUnreadNotificationCount';
import { TodayCountsDocument } from './useTodayOverview.generated';

/** How many of Recipes' pantry suggestions Today previews. */
const SUGGESTION_PREVIEW = 3;

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

  const { pantry, currentHome, selectedHomeId, isReady } = useCurrentPantry();
  const unreadCount = useUnreadNotificationCount();

  const countsResult = useQuery(
    TodayCountsDocument,
    pantry && isFocused
      ? {
          variables: { id: pantry.id, today },
          ...heldFetchPolicy(standDown.fetchPolicy),
        }
      : skipToken,
  );
  // A failed read answers `undefined`; the pantry's last counts for the day stand.
  const stats = usePreservedQueryData(
    countsResult.data ? countsResult.data.pantry?.stats ?? null : undefined,
    null,
    `${pantry?.id ?? ''}:${today}`,
  );

  const {
    state: { currentPlan, mealPlans, hasResult: plansHaveResult },
  } = useMealPlans(standDown);
  const { items, itemDetails } = useActiveMealPlan({
    currentPlanId: currentPlan?.id ?? null,
    planIds: mealPlans.map(plan => plan.id),
    ...standDown,
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

  const { lists, loading: listsLoading } = useShoppingListsLite(standDown);
  const activeListId = useActiveShoppingListId(lists);
  const activeList = lists.find(list => list.id === activeListId);

  const hasNoHousehold = isReady && !selectedHomeId;
  const householdIsEmpty =
    stats?.totalItems === 0 &&
    plansHaveResult &&
    mealPlans.length === 0 &&
    !listsLoading &&
    lists.length === 0;
  const isFirstRun = hasNoHousehold || householdIsEmpty;

  // Only the counts gate the screen: each other section shows when it arrives.
  // Until the pantry resolves there is nothing to ask, which is not an answer.
  const countsState = useDataState({
    loading: countsResult.loading || !pantry,
    error: countsResult.error,
    hasResult: stats !== null || countsResult.data !== undefined,
    isEmpty: false,
  });
  const state: DataState = isFirstRun ? 'empty' : countsState;

  return {
    householdName: currentHome?.name ?? null,
    selectedHomeId,
    unreadCount,
    counts: stats
      ? {
          expired: stats.expiredCount,
          expiring: stats.expiringCount,
          lowStock: stats.lowStockCount,
        }
      : null,
    /** `empty` is the first run: no household, or one with nothing in it yet. */
    state,
    /** The first run starts by creating or joining a household. */
    needsHousehold: hasNoHousehold,
    retry: () => {
      if (pantry) void countsResult.refetch();
    },
    meals,
    suggestions: suggestionsEnabled
      ? toDisplayItems(suggestions.rows.slice(0, SUGGESTION_PREVIEW), t)
      : [],
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
