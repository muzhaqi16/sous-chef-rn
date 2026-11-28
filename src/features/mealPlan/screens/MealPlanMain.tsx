import React, { useRef, useState } from 'react';
import { useTranslation } from '#i18n';
import { parseISO } from 'date-fns';
import type { BarAction } from '#components/molecules/BarActions';
import { MealPlanEmptyState } from '#features/mealPlan/components/MealPlanEmptyState';
import { MealPlanDayView } from '#features/mealPlan/components/MealPlanDayView';
import {
  MealPlanSheets,
  type MealPlanSheet,
} from '#features/mealPlan/components/MealPlanSheets';
import { DataStateView } from '#components/organisms/DataStateView';
import { useDataState } from '#hooks/data/useDataState';
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import type { ItemSelectorRef } from '#components/organisms/AnimatedItemSelector/types';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddMenu } from '#hooks/navigation/useTabBarAddMenu';
import { useTabBarSetters } from '#context/TabBarActionsContext';
import { useSelectorManagement } from '#hooks/ui/useSelectorManagement';
import { useActiveSheet } from '#hooks/ui/useActiveSheet';
import {
  useMealPlanDisplay,
  useMealPlans,
} from '#features/mealPlan/hooks/useMealPlans';
import { useActiveMealPlan } from './useActiveMealPlan';
import { useMealPlanItemHandlers } from './useMealPlanItemHandlers';
import { useMealPlanGuide } from './useMealPlanGuide';
import { useMealPlanCalendar } from '#features/mealPlan/hooks/useMealPlanCalendar';
import { useDailyMeals } from '#features/mealPlan/hooks/useDailyMeals';
import { useMealPlanSelectorConfig } from '#features/mealPlan/screens/useMealPlanSelectorConfig';
import { MealPlanFilterBar } from '#features/mealPlan/components/MealPlanFilterBar';
import {
  EMPTY_MEAL_PLAN_FILTERS,
  type MealPlanFilterState,
} from '#features/mealPlan/utils/mealPlanFilters';
import { useMealPlanPermissions } from '#features/mealPlan/hooks/useMealPlanPermissions';
import { DeferredScreen } from '#components/performance/DeferredScreen';
import { MealPlanSkeleton } from '#features/mealPlan/components/skeletons/MealPlanSkeleton';
import { useAppStore } from '#store/useAppStore';
import type { MealType } from '#graphql/generated/schemaTypes';
import { useTabScreenLifecycle } from '#hooks/performance/useTabScreenLifecycle';
import { executeRefreshWithFinally } from '#utils/finallyHelpers';
import { Screen, type ScreenHeaderConfig } from '#components/templates/Screen';
import { mealPlanTestIDs } from '#features/mealPlan/testIDs';

/** The chrome a plan-less Meal Plan shows, before the DeferredScreen gate and
 *  again while the plan list is still arriving. */
const MealPlanMainFallback: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Screen
      testID={mealPlanTestIDs.screen}
      header={{
        variant: 'tab',
        title: t('labels.mealPlan'),
      }}
      scroll="list"
      gutter="none"
    >
      <MealPlanSkeleton />
    </Screen>
  );
};

/** Gates the heavy work behind DeferredScreen: the skeleton paints instantly and
 *  MealPlanMainInner mounts on the deferred re-render. */
export const MealPlanMain: React.FC = () => (
  <DeferredScreen
    fallback={<MealPlanMainFallback />}
    component={MealPlanMainInner}
  />
);

/**
 * Inner component that runs all heavy hooks.
 * Only mounts after isReady is true, so the skeleton paints instantly.
 */
const MealPlanMainInner: React.FC = () => {
  const { t } = useTranslation();
  const { toCreateMealPlan, toMealTemplateBuilder } = useAppNavigation();
  const { setOverlayOpen } = useTabBarSetters();

  // Plan selector state
  const setSelectedMealPlanId = useAppStore(s => s.setSelectedMealPlanId);
  const selectorRef = useRef<ItemSelectorRef>(null);

  const { handleOpenSelector, handleOverlayOpen, handleOverlayClose } =
    useSelectorManagement({ selectorRef, setOverlayOpen });

  const sheets = useActiveSheet<MealPlanSheet>();
  const openAddMeal = (mealType?: MealType) =>
    sheets.open({ type: 'addMeal', mealType });

  // Fetch meal plans and resolve active plan
  const {
    state: {
      currentPlan,
      mealPlans,
      loading: plansLoading,
      initialLoading: plansInitialLoading,
      error: plansError,
      hasResult: plansHasResult,
      skipped: plansSkipped,
      hasMore: plansHaveMore,
      loadingMore: plansLoadingMore,
    },
    actions: { loadMore: loadMorePlans, refetch: refetchPlans },
  } = useMealPlans();

  // Resolves and fetches the active plan, and owns the fallback when the
  // selected one turns out to be deleted or unshared.
  const plan = useActiveMealPlan({
    currentPlanId: currentPlan?.id ?? null,
    planIds: mealPlans.map(p => p.id),
  });
  const { activePlanId, mealPlan: activeMealPlan, items, refetch } = plan;

  // Lifecycle: perf tracking
  useTabScreenLifecycle({
    screenName: 'MealPlanMain',
    telemetryProperties: () => ({
      plan_id: activePlanId,
      item_count: items.length,
      has_plans: mealPlans.length > 0,
    }),
  });

  // Pull-to-refresh re-reads the shown plan and the list the selector offers.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () =>
    executeRefreshWithFinally(
      () => Promise.allSettled([refetch(), refetchPlans()]),
      setRefreshing,
    );
  // With no plan on screen there is no plan query; the failed one is the list.
  const handleRetryPlans = () =>
    executeRefreshWithFinally(refetchPlans, setRefreshing);

  const plansState = useDataState({
    loading: plansInitialLoading,
    error: plansError,
    hasResult: plansHasResult,
    skipped: plansSkipped,
    isEmpty: mealPlans.length === 0,
  });

  // A plan listed but never read holds no meals on the device, which is not
  // the same as a plan with empty days.
  const planState = useDataState({
    loading: plan.loading,
    error: plan.error,
    hasResult: !!activeMealPlan,
    isEmpty: false,
    skipped: !activePlanId,
  });
  const planUnavailable = planState === 'error' || planState === 'offline';

  const permissions = useMealPlanPermissions(activeMealPlan);

  // The active plan in the list's own shape: `activeMealPlan` is the masked
  // detail read, which is not a `MealPlanDisplayFragment`.
  const activePlanForDisplay = useMealPlanDisplay(activePlanId);

  const calendar = useMealPlanCalendar({
    minDate: activeMealPlan?.startDate
      ? parseISO(activeMealPlan.startDate)
      : undefined,
    maxDate: activeMealPlan?.endDate
      ? parseISO(activeMealPlan.endDate)
      : undefined,
  });
  const day = useDailyMeals(items, calendar.selectedDate);
  const itemHandlers = useMealPlanItemHandlers({
    plan,
    selectedDate: calendar.selectedDate,
    sheets,
  });

  // Always registered, so the `+` says why it cannot add rather than doing
  // nothing. Until the plan is known the add waits, as one Today handed over does.
  const mealAdd = (() => {
    if (permissions.canEdit) return { pending: false };
    if (plansState === 'empty') {
      return { disabledReason: t('mealPlan.addNeedsPlan'), pending: false };
    }
    if (activeMealPlan) {
      return { disabledReason: t('mealPlan.noAddPermission'), pending: false };
    }
    if (plansState === 'error' || plansState === 'offline') {
      return { disabledReason: t('mealPlan.needsThePlan'), pending: false };
    }
    return { disabledReason: t('labels.loading'), pending: true };
  })();
  useTabBarAddMenu([
    {
      key: 'meal',
      label: t('mealTemplateBuilder.addMeal'),
      icon: 'add',
      onPress: () => openAddMeal(),
      ...mealAdd,
    },
  ]);

  // Filters narrow the selector's list only, so the calendar's selected plan is
  // never disturbed by a filter that would exclude it.
  const [planFilters, setPlanFilters] = useState<MealPlanFilterState>(
    EMPTY_MEAL_PLAN_FILTERS,
  );

  const planConfig = useMealPlanSelectorConfig({
    plans: {
      mealPlans,
      hasMore: plansHaveMore,
      loadingMore: plansLoadingMore,
      loadMore: loadMorePlans,
    },
    filters: planFilters,
    selectedMealPlanId: activePlanId,
    loading: plansLoading,
    setSelectedMealPlanId: (id: string) => setSelectedMealPlanId(id),
    selectorRef,
    toCreateMealPlan,
    onCreateFromTemplate: () => sheets.open({ type: 'templates' }),
    onCreateTemplate: () => toMealTemplateBuilder(),
    listHeader:
      mealPlans.length > 0 ? (
        <MealPlanFilterBar filters={planFilters} onChange={setPlanFilters} />
      ) : undefined,
  });

  const tabHeader: ScreenHeaderConfig = {
    variant: 'tab',
    title: t('labels.mealPlan'),
  };

  const guide = useMealPlanGuide({
    noPlans: mealPlans.length === 0 && plansState === 'empty',
    canEdit: permissions.canEdit,
    paused: sheets.active?.type === 'addMeal',
    onCreatePlan: toCreateMealPlan,
    onAddMeal: () => openAddMeal(),
  });

  const sheetsHost = (
    <MealPlanSheets
      sheets={sheets}
      plan={plan}
      display={activePlanForDisplay}
      permissions={permissions}
      items={itemHandlers}
    />
  );

  // Cold start, nothing cached: the skeleton holds until the plan list arrives,
  // not a calendar for a plan that may not exist. A refetch keeps
  // `initialLoading` false, so it never covers content.
  if (plansInitialLoading) {
    return <MealPlanMainFallback />;
  }

  // No plans on screen. Which of the three reasons it is decides what to show:
  // a failed or never-attempted fetch must not offer to create a plan, because
  // the person may already have the very plan they would be recreating.
  if (mealPlans.length === 0) {
    return (
      <Screen
        testID={mealPlanTestIDs.screen}
        header={tabHeader}
        scroll="list"
        gutter="none"
      >
        {plansState === 'error' || plansState === 'offline' ? (
          <DataStateView state={plansState} onRetry={handleRetryPlans} />
        ) : (
          <MealPlanEmptyState
            onCreatePlan={toCreateMealPlan}
            onCreateFromTemplate={() => sheets.open({ type: 'templates' })}
            measureCreate={{
              ref: guide.createRef,
              onLayout: guide.measureCreate,
            }}
          />
        )}
        {sheetsHost}
        {guide.mark}
      </Screen>
    );
  }

  const headerActions: BarAction[] = [];
  if (activePlanId && !planUnavailable) {
    if (permissions.canGenerateShoppingList) {
      headerActions.push({
        icon: 'cart-outline',
        tone: 'primary',
        onPress: () => sheets.open({ type: 'shoppingList' }),
        accessibilityLabel: t('mealPlanMain.generateShoppingListLabel'),
      });
    }
    headerActions.push({
      icon: 'ellipsis-vertical',
      tone: 'textSecondary',
      onPress: () => sheets.open({ type: 'settings' }),
      accessibilityLabel: t('mealPlanMain.planSettingsLabel'),
    });
  }

  return (
    <Screen
      testID={mealPlanTestIDs.screen}
      header={{
        ...tabHeader,
        title:
          activeMealPlan?.name ?? activePlanForDisplay?.name ?? tabHeader.title,
        switchable: { onPress: handleOpenSelector },
        actions: headerActions,
      }}
      scroll="list"
      gutter="none"
    >
      {planUnavailable ? (
        <DataStateView state={planState} onRetry={handleRefresh} />
      ) : (
        <MealPlanDayView
          plan={plan}
          calendar={calendar}
          day={day}
          items={itemHandlers}
          onAddMeal={permissions.canEdit ? openAddMeal : undefined}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      {sheetsHost}

      {/* Plan Selector */}
      <AnimatedItemSelector
        ref={selectorRef}
        config={planConfig}
        onOpen={handleOverlayOpen}
        onClose={handleOverlayClose}
      />
      {guide.mark}
    </Screen>
  );
};
