import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { t as tGlobal } from '#/i18n/t';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { format, parseISO } from 'date-fns';
import { Icon } from '#utils/iconUtils';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { TabMainScreen } from '#components/templates/TabMainScreen';
import { OfflineStatusPill } from '#components/atoms/OfflineStatusPill';
import { useIsOfflineBannerVisible } from '#hooks/app/useIsOfflineBannerVisible';
import { WeekStrip } from '#components/molecules/WeekStrip';
import { MonthCalendar } from '#features/mealPlan/components/MonthCalendar';
import { DayMealList } from '#features/mealPlan/components/DayMealList';
import { CalendarToggleBar } from '#features/mealPlan/components/CalendarToggleBar';
import { MealPlanEmptyState } from '#features/mealPlan/components/MealPlanEmptyState';
import { AddMealSheet } from '#features/mealPlan/components/AddMealSheet';
import { SaveAsTemplateSheet } from '#features/mealPlan/components/SaveAsTemplateSheet';
import { TemplateBrowserSheet } from '#features/mealPlan/components/TemplateBrowserSheet';
import { TemplatePreviewSheet } from '#features/mealPlan/components/TemplatePreviewSheet';
import { GenerateShoppingListSheet } from '#features/mealPlan/components/GenerateShoppingListSheet';
import { MealPlanSettingsSheet } from '#features/mealPlan/components/MealPlanSettingsSheet';
import { DuplicatePlanSheet } from '#features/mealPlan/components/DuplicatePlanSheet';
import { MarkCookedModal } from '#components/modals/MarkCookedModal';
import { NutritionSummaryCard } from '#features/mealPlan/components/NutritionSummaryCard';
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import type { ItemSelectorRef } from '#components/organisms/AnimatedItemSelector/types';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { useTabBarSetters } from '#/context/TabBarActionsContext';
import { useSelectorManagement } from '#hooks/ui/useSelectorManagement';
import { useMealPlans } from '#features/mealPlan/hooks/useMealPlans';
import { useMealPlan } from '#features/mealPlan/hooks/useMealPlan';
import { useMealPlanItemActions } from '#features/mealPlan/hooks/useMealPlanItemActions';
import { useMealPlanCalendar } from '#features/mealPlan/hooks/useMealPlanCalendar';
import { useDailyMeals } from '#features/mealPlan/hooks/useDailyMeals';
import { useMealTemplateActions } from '#features/mealPlan/hooks/useMealTemplateActions';
import { useMealPlanSelectorConfig } from '#features/mealPlan/hooks/useMealPlanSelectorConfig';
import {
  MealPlanFilterBar,
  filterMealPlans,
  EMPTY_MEAL_PLAN_FILTERS,
  type MealPlanFilterState,
} from '#features/mealPlan/components/MealPlanFilterBar';
import { useGenerateShoppingList } from '#features/mealPlan/hooks/useGenerateShoppingList';
import { useDuplicateMealPlan } from '#features/mealPlan/hooks/useDuplicateMealPlan';
import { useMealPlanPermissions } from '#features/mealPlan/hooks/useMealPlanPermissions';
import { DeferredScreen } from '#components/performance/DeferredScreen';
import { MealPlanSkeleton } from '#components/base/Skeleton/MealPlanSkeleton';
import { useAppStore } from '#store/useAppStore';
import {
  MealType,
  type TemplateCategory,
} from '#/graphql/generated/schemaTypes';
import { useMealPlanActions } from '#features/mealPlan/hooks/useMealPlanActions';
import { type MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { toastService } from '#/services/toastService';
import { useTabScreenLifecycle } from '#hooks/performance/useTabScreenLifecycle';

async function executeMealPlanRefresh(
  refetchFn: () => Promise<unknown>,
  setRefreshing: (v: boolean) => void,
) {
  setRefreshing(true);
  try {
    await refetchFn();
  } catch {
    // Silently handle — Apollo will surface errors via its error state
  } finally {
    setRefreshing(false);
  }
}

/**
 * Outer component that gates heavy work behind DeferredScreen.
 * Skeleton paints instantly; MealPlanMainInner mounts on the deferred re-render.
 *
 * Uses `tGlobal` (i18next instance directly) instead of `useTranslation()` so this
 * wrapper does not subscribe to language changes. Subscribing here would re-render
 * the wrapper just to flip skeleton labels that MealPlanMainInner replaces on
 * mount anyway, defeating the point of the deferred split. All translations inside
 * MealPlanMainInner go through `t` from `useTranslation()`.
 */
export const MealPlanMain: React.FC = () => (
  <DeferredScreen
    fallback={
      <TabMainScreen testID="meal-plan-screen">
        <TabScreenHeader
          label={tGlobal('mealPlanMain.label')}
          title={tGlobal('mealPlanMain.defaultTitle')}
        />
        <MealPlanSkeleton />
      </TabMainScreen>
    }
    component={MealPlanMainInner}
  />
);

/**
 * Inner component that runs all heavy hooks.
 * Only mounts after isReady is true, so the skeleton paints instantly.
 */
const MealPlanMainInner: React.FC = () => {
  const { t } = useTranslation();
  const { toRecipeDetail, toCreateMealPlan, toMealTemplateBuilder } =
    useAppNavigation();
  const { setOverlayOpen } = useTabBarSetters();

  // Plan selector state
  const selectedMealPlanId = useAppStore(s => s.selectedMealPlanId);
  const setSelectedMealPlanId = useAppStore(s => s.setSelectedMealPlanId);
  const selectorRef = useRef<ItemSelectorRef>(null);

  const { handleOpenSelector, handleOverlayOpen, handleOverlayClose } =
    useSelectorManagement({ selectorRef, setOverlayOpen });

  // Add meal sheet state
  const [addMealVisible, setAddMealVisible] = useState(false);
  const [addMealType, setAddMealType] = useState<MealType | undefined>();

  // Template state
  const [saveTemplateVisible, setSaveTemplateVisible] = useState(false);
  const [templateBrowserVisible, setTemplateBrowserVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<MealTemplateDisplayFragment | null>(null);
  const [templatePreviewVisible, setTemplatePreviewVisible] = useState(false);

  // Shopping list generation state
  const [shoppingListSheetVisible, setShoppingListSheetVisible] =
    useState(false);

  // Mark cooked modal state — only what MarkCookedModal renders plus the id
  // we hand back to `toggleCompleted`.
  const [markCookedVisible, setMarkCookedVisible] = useState(false);
  const [pendingCook, setPendingCook] = useState<{
    id: string;
    recipeName: string;
    defaultServings: number;
  } | null>(null);

  // Settings and duplicate state
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [duplicateVisible, setDuplicateVisible] = useState(false);

  const {
    createPlanFromTemplate,
    createTemplateFromPlan,
    creatingFromTemplate,
    creatingTemplate,
    isApiUnavailable: templateActionsUnavailable,
  } = useMealTemplateActions();

  // Fetch meal plans and resolve active plan
  const {
    state: { currentPlan, mealPlans, loading: plansLoading },
  } = useMealPlans();
  const activePlanId =
    selectedMealPlanId ?? currentPlan?.id ?? mealPlans[0]?.id ?? null;

  // The action cluster carries the offline pill (visible only while offline)
  // plus the per-plan actions; render it only when one of those would show,
  // so an online, plan-less header doesn't emit an empty action row.
  const isOfflineVisible = useIsOfflineBannerVisible();

  // Fetch the active plan with items
  const {
    mealPlan: activeMealPlan,
    mealPlanRef: activeMealPlanRef,
    items,
    nutritionSummary,
    refetch,
  } = useMealPlan(activePlanId);

  // Lifecycle: optimistic restoration, cache persistence, perf tracking
  useTabScreenLifecycle({
    screenName: 'MealPlanMain',
    optimisticTypes: ['MealPlan', 'MealPlanItem'],
    telemetryProperties: () => ({
      plan_id: activePlanId,
      item_count: items.length,
      has_plans: mealPlans.length > 0,
    }),
  });

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => executeMealPlanRefresh(refetch, setRefreshing);

  // Permissions for the active plan
  const permissions = useMealPlanPermissions(activeMealPlan);

  // Compute plan date boundaries
  const planStartDate = activeMealPlan?.startDate
    ? parseISO(activeMealPlan.startDate)
    : undefined;
  const planEndDate = activeMealPlan?.endDate
    ? parseISO(activeMealPlan.endDate)
    : undefined;

  // Calendar state
  const calendar = useMealPlanCalendar({
    minDate: planStartDate,
    maxDate: planEndDate,
  });

  // Daily meals for selected date
  const { dailyMeals, isEmpty } = useDailyMeals(items, calendar.selectedDate);

  // Meal plan item actions
  const { createItem, toggleCompleted, deleteItem } =
    useMealPlanItemActions(activePlanId);

  // Shopping list generation
  const {
    generateShoppingList,
    loading: generatingShoppingList,
    isApiUnavailable: generateShoppingListUnavailable,
  } = useGenerateShoppingList(activePlanId);

  // Duplicate meal plan
  const {
    duplicatePlan,
    loading: duplicatingPlan,
    isApiUnavailable: duplicatePlanUnavailable,
  } = useDuplicateMealPlan();

  // Delete meal plan
  const { deleteMealPlan, deleting: deletingPlan } = useMealPlanActions();

  // Compute days with meals for calendar indicators
  const daysWithMeals = (() => {
    const days = new Set<string>();
    items.forEach(item => {
      days.add(format(new Date(item.date), 'yyyy-MM-dd'));
    });
    return days;
  })();

  // Tap-to-toggle calendar between week and month view
  const toggleCalendarView = () => {
    if (calendar.viewMode === 'week') {
      calendar.setViewMode('month');
    } else {
      calendar.setViewMode('week');
    }
  };

  // Register add button - opens add meal sheet (only if user can edit)
  useTabBarAddButton(
    permissions.canEdit
      ? () => {
          setAddMealType(undefined);
          setAddMealVisible(true);
        }
      : undefined,
  );

  const handleToggleCompleted = (
    id: string,
    isCompleted: boolean,
    hasRecipe: boolean,
  ) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    // Show MarkCookedModal when marking a recipe meal as complete
    if (!isCompleted && hasRecipe) {
      setPendingCook({
        id: item.id,
        recipeName: item.recipe?.name ?? '',
        defaultServings: item.servings ?? item.recipe?.servings ?? 1,
      });
      setMarkCookedVisible(true);
      return;
    }

    // For unchecking or custom meals, toggle directly
    toggleCompleted(id);
  };

  // Granular deduction isn't part of the meal-plan flow — the API derives the
  // pantry deduction from the recipe's ingredients when deductFromPantry is set.
  const handleMarkCooked = (input: {
    servings: number;
    deductFromPantry: boolean;
    notes?: string;
  }) => {
    if (!pendingCook) return;
    toggleCompleted(pendingCook.id, {
      deductFromPantry: input.deductFromPantry,
      servings: input.servings,
      notes: input.notes,
    });
    setPendingCook(null);
  };

  const handleDeleteItem = (id: string) => {
    deleteItem(id);
  };

  const handleAddRecipe = async (recipeId: string, mealType: MealType) => {
    if (!activePlanId) return;
    const result = await createItem({
      mealPlanId: activePlanId,
      meal: { recipeId },
      mealType,
      date: calendar.selectedDate.toISOString(),
    });
    if (result) {
      setAddMealVisible(false);
    }
  };

  const handleAddCustomMeal = async (name: string, mealType: MealType) => {
    if (!activePlanId) return;
    const result = await createItem({
      mealPlanId: activePlanId,
      meal: { customMealName: name },
      mealType,
      date: calendar.selectedDate.toISOString(),
    });
    if (result) {
      setAddMealVisible(false);
    }
  };

  const handleOpenAddMeal = (mealType?: MealType) => {
    setAddMealType(mealType);
    setAddMealVisible(true);
  };

  const handleItemPress = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item?.recipe?.id) {
      toRecipeDetail({ recipeId: item.recipe.id });
    }
  };

  const handleCreatePlan = () => {
    toCreateMealPlan();
  };

  const handleSaveAsTemplate = () => {
    setSaveTemplateVisible(true);
  };

  const handleSaveTemplate = async (input: {
    mealPlanId: string;
    name: string;
    description?: string;
    category?: TemplateCategory;
    tags?: string[];
  }) => {
    const result = await createTemplateFromPlan(input);
    if (result?.__typename === 'CreateTemplateFromMealPlanPayload') {
      setSaveTemplateVisible(false);
    }
  };

  const handleOpenTemplateBrowser = () => {
    setTemplateBrowserVisible(true);
  };

  // Plan selector config. Filters apply client-side to the selector's list only
  // (search / active-only / plan type), so the main calendar's selected plan is
  // never disturbed by a filter that would exclude it.
  const [planFilters, setPlanFilters] = useState<MealPlanFilterState>(
    EMPTY_MEAL_PLAN_FILTERS,
  );
  const filteredMealPlans = filterMealPlans(mealPlans, planFilters, new Date());

  const planConfig = useMealPlanSelectorConfig({
    mealPlans: filteredMealPlans,
    selectedMealPlanId: activePlanId,
    loading: plansLoading,
    setSelectedMealPlanId: (id: string) => setSelectedMealPlanId(id),
    selectorRef,
    toCreateMealPlan,
    onCreateFromTemplate: handleOpenTemplateBrowser,
    onCreateTemplate: () => toMealTemplateBuilder(),
    listHeader:
      mealPlans.length > 0 ? (
        <MealPlanFilterBar filters={planFilters} onChange={setPlanFilters} />
      ) : undefined,
  });

  const handleSelectTemplate = (template: MealTemplateDisplayFragment) => {
    setSelectedTemplate(template);
    setTemplateBrowserVisible(false);
    setTemplatePreviewVisible(true);
  };

  const handleCreateFromTemplate = async (config: {
    templateId: string;
    startDate: string;
    name?: string;
    servings?: number;
  }) => {
    const result = await createPlanFromTemplate(config);
    if (result?.__typename === 'CreateMealPlanPayload') {
      setTemplatePreviewVisible(false);
      setSelectedTemplate(null);
    }
  };

  const handleDuplicatePlan = async (input: {
    mealPlanId: string;
    newName: string;
    newStartDate: string;
    newEndDate: string;
  }) => {
    const result = await duplicatePlan(input);
    if (result?.__typename === 'DuplicateMealPlanPayload') {
      setDuplicateVisible(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    const success = await deleteMealPlan(id);
    if (success) {
      toastService.success(t('mealPlanMain.mealPlanDeleted'));
      // If we deleted the active plan, clear the selection so the UI falls back
      // to the next available plan (or the empty state if none remain).
      if (id === activePlanId) {
        setSelectedMealPlanId(null);
      }
    }
  };

  const handleGenerateShoppingList = async (options: {
    checkPantry?: boolean;
    name?: string;
    shoppingListId?: string;
  }) => {
    const result = await generateShoppingList(options);
    if (result?.__typename === 'GenerateShoppingListFromMealPlanPayload') {
      setShoppingListSheetVisible(false);
    }
  };

  // Show empty state if no plans exist and not loading
  if (!plansLoading && mealPlans.length === 0) {
    return (
      <TabMainScreen testID="meal-plan-screen">
        <TabScreenHeader
          label={t('mealPlanMain.label')}
          title={t('mealPlanMain.defaultTitle')}
        />
        <MealPlanEmptyState
          onCreatePlan={handleCreatePlan}
          onCreateFromTemplate={handleOpenTemplateBrowser}
        />

        {/* Template Browser Sheet */}
        <TemplateBrowserSheet
          visible={templateBrowserVisible}
          onClose={() => setTemplateBrowserVisible(false)}
          onSelectTemplate={handleSelectTemplate}
        />

        {/* Template Preview Sheet */}
        <TemplatePreviewSheet
          visible={templatePreviewVisible}
          template={selectedTemplate}
          onClose={() => {
            setTemplatePreviewVisible(false);
            setSelectedTemplate(null);
          }}
          onConfirm={handleCreateFromTemplate}
          confirmLoading={creatingFromTemplate}
          disabled={templateActionsUnavailable}
          onEdit={id => {
            setTemplatePreviewVisible(false);
            setSelectedTemplate(null);
            toMealTemplateBuilder({ templateId: id });
          }}
        />
      </TabMainScreen>
    );
  }

  return (
    <TabMainScreen testID="meal-plan-screen">
      <View style={styles.headerRow}>
        <View style={styles.headerContent}>
          <TabScreenHeader
            label={t('mealPlanMain.label')}
            title={activeMealPlan?.name ?? t('mealPlanMain.defaultTitle')}
            onTitlePress={handleOpenSelector}
            titleAccessory={
              <Icon name="chevron-down" size={20} tone="textPrimary" />
            }
            offlinePill={false}
          />
        </View>
        {/* Pill lives in the real action cluster so it aligns with the
            cart/bookmark/settings icons (TabScreenHeader's built-in pill is
            disabled above). Rendered whenever the pill (offline) or a per-plan
            action would show, so the pill still appears before a plan is
            selected without leaving an empty row when online + plan-less. */}
        {isOfflineVisible || !!activePlanId ? (
          <View style={styles.headerActions}>
            <OfflineStatusPill size={22} />
            {!!activePlanId && (
              <>
                {permissions.canGenerateShoppingList ? (
                  <Pressable
                    onPress={() => setShoppingListSheetVisible(true)}
                    disabled={generateShoppingListUnavailable}
                    hitSlop={8}
                    style={styles.headerActionButton}
                    accessibilityLabel={t(
                      'mealPlanMain.generateShoppingListLabel',
                    )}
                  >
                    <Icon
                      name="cart-outline"
                      size={22}
                      tone={
                        generateShoppingListUnavailable
                          ? 'textSecondary'
                          : 'primary'
                      }
                    />
                  </Pressable>
                ) : null}
                {permissions.canSaveAsTemplate ? (
                  <Pressable
                    onPress={handleSaveAsTemplate}
                    disabled={templateActionsUnavailable}
                    hitSlop={8}
                    style={styles.headerActionButton}
                    accessibilityLabel={t('mealPlanMain.saveAsTemplateLabel')}
                  >
                    <Icon
                      name="bookmark-outline"
                      size={22}
                      tone={
                        templateActionsUnavailable ? 'textSecondary' : 'primary'
                      }
                    />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setSettingsVisible(true)}
                  hitSlop={8}
                  style={styles.headerActionButton}
                  accessibilityLabel={t('mealPlanMain.planSettingsLabel')}
                >
                  <Icon
                    name="ellipsis-vertical"
                    size={22}
                    tone="textSecondary"
                  />
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </View>

      {/* Calendar view */}
      {calendar.viewMode === 'week' ? (
        <WeekStrip
          weekDays={calendar.weekDays}
          selectedDate={calendar.selectedDate}
          onSelectDate={calendar.selectDate}
          onPrevWeek={calendar.goToPrevWeek}
          onNextWeek={calendar.goToNextWeek}
          daysWithMeals={daysWithMeals}
          canGoPrev={calendar.canGoPrevWeek}
          canGoNext={calendar.canGoNextWeek}
          minDate={calendar.minDate}
          maxDate={calendar.maxDate}
        />
      ) : (
        <MonthCalendar
          selectedDate={calendar.selectedDate}
          onSelectDate={calendar.selectDate}
          daysWithMeals={daysWithMeals}
          minDate={calendar.minDate}
          maxDate={calendar.maxDate}
        />
      )}

      {/* Calendar toggle bar */}
      <CalendarToggleBar
        isExpanded={calendar.viewMode === 'month'}
        onToggle={toggleCalendarView}
      />

      {/* Daily meals */}
      <DayMealList
        selectedDate={calendar.selectedDate}
        dailyMeals={dailyMeals}
        isEmpty={isEmpty}
        onToggleCompleted={
          permissions.canEdit ? handleToggleCompleted : undefined
        }
        onItemPress={handleItemPress}
        onDeleteItem={permissions.canEdit ? handleDeleteItem : undefined}
        onAddMeal={permissions.canEdit ? handleOpenAddMeal : undefined}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        listHeader={
          nutritionSummary ? (
            <View style={styles.nutritionContainer}>
              <NutritionSummaryCard
                nutritionSummary={nutritionSummary}
                nutritionGoalProgress={activeMealPlan?.nutritionGoalProgress}
              />
            </View>
          ) : undefined
        }
      />

      {/* Add meal bottom sheet */}
      <AddMealSheet
        visible={addMealVisible}
        onClose={() => setAddMealVisible(false)}
        initialMealType={addMealType}
        onAddRecipe={handleAddRecipe}
        onAddCustomMeal={handleAddCustomMeal}
      />

      {/* Save as Template Sheet */}
      <SaveAsTemplateSheet
        visible={saveTemplateVisible}
        mealPlanId={activePlanId}
        mealPlanName={currentPlan?.name}
        homeName={activeMealPlan?.home?.name}
        onClose={() => setSaveTemplateVisible(false)}
        onSave={handleSaveTemplate}
        saving={creatingTemplate}
        disabled={templateActionsUnavailable}
      />

      {/* Template Browser Sheet */}
      <TemplateBrowserSheet
        visible={templateBrowserVisible}
        onClose={() => setTemplateBrowserVisible(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Template Preview Sheet */}
      <TemplatePreviewSheet
        visible={templatePreviewVisible}
        template={selectedTemplate}
        onClose={() => {
          setTemplatePreviewVisible(false);
          setSelectedTemplate(null);
        }}
        onConfirm={handleCreateFromTemplate}
        confirmLoading={creatingFromTemplate}
        disabled={templateActionsUnavailable}
      />

      {/* Generate Shopping List Sheet */}
      <GenerateShoppingListSheet
        visible={shoppingListSheetVisible}
        onClose={() => setShoppingListSheetVisible(false)}
        onGenerate={handleGenerateShoppingList}
        loading={generatingShoppingList}
        homeName={activeMealPlan?.home?.name}
        disabled={generateShoppingListUnavailable}
      />

      {/* Settings Sheet */}
      <MealPlanSettingsSheet
        visible={settingsVisible}
        mealPlanRef={activeMealPlanRef}
        permissions={permissions}
        onClose={() => setSettingsVisible(false)}
        onDuplicate={() => setDuplicateVisible(true)}
        onGenerateShoppingList={() => setShoppingListSheetVisible(true)}
        onDelete={handleDeletePlan}
        deleting={deletingPlan}
      />

      {/* Duplicate Plan Sheet */}
      <DuplicatePlanSheet
        visible={duplicateVisible}
        mealPlan={currentPlan ?? null}
        onClose={() => setDuplicateVisible(false)}
        onDuplicate={handleDuplicatePlan}
        loading={duplicatingPlan}
        disabled={duplicatePlanUnavailable}
      />

      {/* Mark Cooked Modal */}
      <MarkCookedModal
        visible={markCookedVisible}
        recipeName={pendingCook?.recipeName ?? ''}
        defaultServings={pendingCook?.defaultServings ?? 1}
        onClose={() => {
          setMarkCookedVisible(false);
          setPendingCook(null);
        }}
        onConfirm={handleMarkCooked}
      />

      {/* Plan Selector */}
      <AnimatedItemSelector
        ref={selectorRef}
        config={planConfig}
        onOpen={handleOverlayOpen}
        onClose={handleOverlayClose}
      />
    </TabMainScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerContent: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    paddingRight: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  headerActionButton: {
    padding: theme.spacing.xs,
  },
  nutritionContainer: {
    marginBottom: theme.spacing.sm,
  },
}));
