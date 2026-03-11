import React, { useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { format, parseISO } from 'date-fns';
import { Icon } from '#utils/iconUtils';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { WeekStrip } from '#components/mealPlan/WeekStrip';
import { MonthCalendar } from '#components/mealPlan/MonthCalendar';
import { DayMealList } from '#components/mealPlan/DayMealList';
import { CalendarToggleBar } from '#components/mealPlan/CalendarToggleBar';
import { MealPlanEmptyState } from '#components/mealPlan/MealPlanEmptyState';
import { AddMealSheet } from '#components/mealPlan/AddMealSheet';
import { SaveAsTemplateSheet } from '#components/mealPlan/SaveAsTemplateSheet';
import { TemplateBrowserSheet } from '#components/mealPlan/TemplateBrowserSheet';
import { TemplatePreviewSheet } from '#components/mealPlan/TemplatePreviewSheet';
import { GenerateShoppingListSheet } from '#components/mealPlan/GenerateShoppingListSheet';
import { MealPlanSettingsSheet } from '#components/mealPlan/MealPlanSettingsSheet';
import { DuplicatePlanSheet } from '#components/mealPlan/DuplicatePlanSheet';
import { MarkCookedModal } from '#components/modals/MarkCookedModal';
import { EditCustomMealSheet } from '#components/mealPlan/EditCustomMealSheet';
import { NutritionSummaryCard } from '#components/mealPlan/NutritionSummaryCard';
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import type { ItemSelectorRef } from '#components/organisms/AnimatedItemSelector/types';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { useTabBarSetters } from '#/context/TabBarActionsContext';
import { useSelectorManagement } from '#hooks/ui/useSelectorManagement';
import { useMealPlans } from '#hooks/mealPlan/useMealPlans';
import { useMealPlan } from '#hooks/mealPlan/useMealPlan';
import { useMealPlanItemActions } from '#hooks/mealPlan/useMealPlanItemActions';
import { useMealPlanCalendar } from '#hooks/mealPlan/useMealPlanCalendar';
import { useDailyMeals } from '#hooks/mealPlan/useDailyMeals';
import { useMealTemplateActions } from '#hooks/mealPlan/useMealTemplateActions';
import { useMealPlanSelectorConfig } from '#hooks/mealPlan/useMealPlanSelectorConfig';
import { useGenerateShoppingList } from '#hooks/mealPlan/useGenerateShoppingList';
import { useDuplicateMealPlan } from '#hooks/mealPlan/useDuplicateMealPlan';
import { useMealPlanPermissions } from '#hooks/mealPlan/useMealPlanPermissions';
import { DeferredScreen } from '#components/performance/DeferredScreen';
import { MealPlanSkeleton } from '#components/base/Skeleton/MealPlanSkeleton';
import { useAppStore } from '#store/useAppStore';
import {
  useDeleteMealPlanMutation,
  GetMealPlansDocument,
  SortOrder,
  MealType,
  type MealPlanItemFragment,
  type MealTemplateDisplayFragment } from '#generated';
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
 */
export const MealPlanMain: React.FC = () => (
  <DeferredScreen
    fallback={
      <View style={styles.container} testID="meal-plan-screen">
        <TabScreenHeader label="Plan your meals" title="Meal Plan" />
        <MealPlanSkeleton />
      </View>
    }
    component={MealPlanMainInner}
  />
);

/**
 * Inner component that runs all heavy hooks.
 * Only mounts after isReady is true, so the skeleton paints instantly.
 */
const MealPlanMainInner: React.FC = () => {
  const { theme } = useUnistyles();
  const { navigate } = useAppNavigation();
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
  const [selectedTemplate, setSelectedTemplate] = useState<MealTemplateDisplayFragment | null>(null);
  const [templatePreviewVisible, setTemplatePreviewVisible] = useState(false);

  // Shopping list generation state
  const [shoppingListSheetVisible, setShoppingListSheetVisible] = useState(false);

  // Mark cooked modal state
  const [markCookedVisible, setMarkCookedVisible] = useState(false);
  const [pendingCookItem, setPendingCookItem] = useState<MealPlanItemFragment | null>(null);

  // Edit custom meal state
  const [editCustomMealVisible, setEditCustomMealVisible] = useState(false);
  const [editingCustomItem, setEditingCustomItem] = useState<MealPlanItemFragment | null>(null);

  // Settings and duplicate state
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [duplicateVisible, setDuplicateVisible] = useState(false);

  const {
    createPlanFromTemplate,
    createTemplateFromPlan,
    creatingFromTemplate,
    creatingTemplate } = useMealTemplateActions();

  // Fetch meal plans and resolve active plan
  const { currentPlan, mealPlans, loading: plansLoading } = useMealPlans();
  const activePlanId = selectedMealPlanId ?? currentPlan?.id ?? mealPlans[0]?.id ?? null;

  // Fetch the active plan with items
  const { mealPlan: activeMealPlan, items, nutritionSummary, refetch } = useMealPlan(activePlanId);

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
  const planStartDate = (activeMealPlan?.startDate ? parseISO(activeMealPlan.startDate) : undefined);
  const planEndDate = (activeMealPlan?.endDate ? parseISO(activeMealPlan.endDate) : undefined);

  // Calendar state
  const calendar = useMealPlanCalendar({
    minDate: planStartDate,
    maxDate: planEndDate });

  // Daily meals for selected date
  const { dailyMeals, totalCalories, isEmpty } = useDailyMeals(
    items,
    calendar.selectedDate,
  );

  // Meal plan item actions
  const { createItem, updateItem, toggleCompleted, deleteItem } =
    useMealPlanItemActions(activePlanId);

  // Shopping list generation
  const { generateShoppingList, loading: generatingShoppingList } =
    useGenerateShoppingList(activePlanId);

  // Duplicate meal plan
  const { duplicatePlan, loading: duplicatingPlan } = useDuplicateMealPlan();

  // Delete meal plan
  const [deletePlanMutation, { loading: deletingPlan }] = useDeleteMealPlanMutation({
    refetchQueries: [{ query: GetMealPlansDocument, variables: { first: 20, orderBy: { startDate: SortOrder.Desc } } }],
    onError: error => {
      toastService.error(error.message || 'Failed to delete meal plan');
    } });

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

  // Register add button - opens add meal sheet
  useTabBarAddButton(() => {
    setAddMealType(undefined);
    setAddMealVisible(true);
  });

  const handleToggleCompleted = (id: string, isCompleted: boolean, hasRecipe: boolean) => {
      const item = items.find(i => i.id === id);
      if (!item) return;

      // Show MarkCookedModal when marking a recipe meal as complete
      if (!isCompleted && hasRecipe) {
        setPendingCookItem(item);
        setMarkCookedVisible(true);
        return;
      }

      // For unchecking or custom meals, toggle directly
      toggleCompleted(item);
    };

  const handleMarkCooked = (input: {
      servings: number;
      deductFromPantry: boolean;
      useGranularDeduction: boolean;
      notes?: string;
    }) => {
      if (!pendingCookItem) return;
      toggleCompleted(pendingCookItem, {
        deductFromPantry: input.deductFromPantry,
        servings: input.servings,
        notes: input.notes });
      setPendingCookItem(null);
    };

  const handleDeleteItem = (id: string) => {
      deleteItem(id);
    };

  const handleAddRecipe = async (recipeId: string, mealType: MealType) => {
      if (!activePlanId) return;
      const result = await createItem({
        mealPlanId: activePlanId,
        recipeId,
        mealType,
        date: calendar.selectedDate.toISOString() });
      if (result) {
        setAddMealVisible(false);
      }
    };

  const handleAddCustomMeal = async (name: string, mealType: MealType) => {
      if (!activePlanId) return;
      const result = await createItem({
        mealPlanId: activePlanId,
        customMealName: name,
        mealType,
        date: calendar.selectedDate.toISOString() });
      if (result) {
        setAddMealVisible(false);
      }
    };

  const handleOpenAddMeal = (mealType?: MealType) => {
      setAddMealType(mealType);
      setAddMealVisible(true);
    };

  const handleItemPress = (item: MealPlanItemFragment) => {
      if (item.recipe?.id) {
        navigate('RecipeDetail', { recipeId: item.recipe.id });
      } else if (item.customMealName) {
        setEditingCustomItem(item);
        setEditCustomMealVisible(true);
      }
    };

  const handleSaveCustomMeal = (id: string, input: { customMealName?: string; notes?: string }) => {
      updateItem(id, input);
    };

  const handleCreatePlan = () => {
    navigate('CreateMealPlan');
  };

  const handleSaveAsTemplate = () => {
    setSaveTemplateVisible(true);
  };

  const handleSaveTemplate = async (input: {
      mealPlanId: string;
      name: string;
      description?: string;
      category?: any;
      tags?: string[];
    }) => {
      const result = await createTemplateFromPlan(input);
      if (result?.success) {
        setSaveTemplateVisible(false);
      }
    };

  const handleOpenTemplateBrowser = () => {
    setTemplateBrowserVisible(true);
  };

  // Plan selector config
  const planConfig = useMealPlanSelectorConfig({
    mealPlans,
    selectedMealPlanId: activePlanId,
    loading: plansLoading,
    setSelectedMealPlanId: (id: string) => setSelectedMealPlanId(id),
    selectorRef,
    navigate,
    onCreateFromTemplate: handleOpenTemplateBrowser });

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
      if (result?.success) {
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
      if (result?.success) {
        setDuplicateVisible(false);
      }
    };

  const handleDeletePlan = async (id: string) => {
      let result;
      try {
        result = await deletePlanMutation({ variables: { id } });
      } catch {
        // Error handled by onError callback
        return;
      }
      if (result.data?.deleteMealPlan?.success) {
        toastService.success('Meal plan deleted');
      }
    };

  const handleGenerateShoppingList = async (options: {
      checkPantry?: boolean;
      name?: string;
      shoppingListId?: string;
    }) => {
      const result = await generateShoppingList(options);
      if (result?.success) {
        setShoppingListSheetVisible(false);
      }
    };

  // Show empty state if no plans exist and not loading
  if (!plansLoading && mealPlans.length === 0) {
    return (
      <View style={styles.container} testID="meal-plan-screen">
        <TabScreenHeader
          label="Plan your meals"
          title="Meal Plan"
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
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="meal-plan-screen">
      <View style={styles.headerRow}>
        <View style={styles.headerContent}>
          <TabScreenHeader
            label="Plan your meals"
            title={activeMealPlan?.name ?? 'Meal Plan'}
            onTitlePress={handleOpenSelector}
            titleAccessory={
              <Icon
                name="chevron-down"
                size={20}
                color={theme.colors.textPrimary}
              />
            }
          />
        </View>
        {!!activePlanId && (
          <View style={styles.headerActions}>
            {permissions.canGenerateShoppingList ? (
              <Pressable
                onPress={() => setShoppingListSheetVisible(true)}
                hitSlop={8}
                style={styles.headerActionButton}
                accessibilityLabel="Generate shopping list"
              >
                <Icon
                  name="cart-outline"
                  size={22}
                  color={theme.colors.primary}
                />
              </Pressable>
            ) : null}
            {permissions.canSaveAsTemplate ? (
              <Pressable
                onPress={handleSaveAsTemplate}
                hitSlop={8}
                style={styles.headerActionButton}
                accessibilityLabel="Save as template"
              >
                <Icon
                  name="bookmark-outline"
                  size={22}
                  color={theme.colors.primary}
                />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setSettingsVisible(true)}
              hitSlop={8}
              style={styles.headerActionButton}
              accessibilityLabel="Plan settings"
            >
              <Icon
                name="ellipsis-vertical"
                size={22}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          </View>
        )}
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
        totalCalories={totalCalories}
        isEmpty={isEmpty}
        onToggleCompleted={handleToggleCompleted}
        onItemPress={handleItemPress}
        onDeleteItem={handleDeleteItem}
        onAddMeal={handleOpenAddMeal}
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
      />

      {/* Generate Shopping List Sheet */}
      <GenerateShoppingListSheet
        visible={shoppingListSheetVisible}
        onClose={() => setShoppingListSheetVisible(false)}
        onGenerate={handleGenerateShoppingList}
        loading={generatingShoppingList}
        homeName={activeMealPlan?.home?.name}
      />

      {/* Settings Sheet */}
      <MealPlanSettingsSheet
        visible={settingsVisible}
        mealPlan={activeMealPlan}
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
      />

      {/* Mark Cooked Modal */}
      <MarkCookedModal
        visible={markCookedVisible}
        recipeName={pendingCookItem?.recipe?.name ?? ''}
        defaultServings={pendingCookItem?.servings ?? pendingCookItem?.recipe?.servings ?? 1}
        onClose={() => {
          setMarkCookedVisible(false);
          setPendingCookItem(null);
        }}
        onConfirm={handleMarkCooked}
      />

      {/* Edit Custom Meal Sheet */}
      <EditCustomMealSheet
        visible={editCustomMealVisible}
        item={editingCustomItem}
        onClose={() => {
          setEditCustomMealVisible(false);
          setEditingCustomItem(null);
        }}
        onSave={handleSaveCustomMeal}
      />

      {/* Plan Selector */}
      <AnimatedItemSelector
        ref={selectorRef}
        config={planConfig}
        onOpen={handleOverlayOpen}
        onClose={handleOverlayClose}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start' },
  headerContent: {
    flex: 1 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    paddingRight: theme.spacing.md,
    gap: theme.spacing.sm },
  headerActionButton: {
    padding: theme.spacing.xs },
  nutritionContainer: {
    marginBottom: theme.spacing.sm } }));
