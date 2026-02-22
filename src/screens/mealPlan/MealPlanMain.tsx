import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { format } from 'date-fns';
import { Icon } from '#utils/iconUtils';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { WeekStrip } from '#components/mealPlan/WeekStrip';
import { MonthCalendar } from '#components/mealPlan/MonthCalendar';
import { DayMealList } from '#components/mealPlan/DayMealList';
import { MealPlanEmptyState } from '#components/mealPlan/MealPlanEmptyState';
import { AddMealSheet, type AddMealSheetRef } from '#components/mealPlan/AddMealSheet';
import { SaveAsTemplateSheet } from '#components/mealPlan/SaveAsTemplateSheet';
import { TemplateBrowserSheet } from '#components/mealPlan/TemplateBrowserSheet';
import { TemplatePreviewSheet } from '#components/mealPlan/TemplatePreviewSheet';
import { GenerateShoppingListSheet } from '#components/mealPlan/GenerateShoppingListSheet';
import { MealPlanSettingsSheet } from '#components/mealPlan/MealPlanSettingsSheet';
import { DuplicatePlanSheet } from '#components/mealPlan/DuplicatePlanSheet';
import { useProfileData } from '#hooks/profile/useProfileData';
import { useAppStore } from '#store/useAppStore';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { useMealPlans } from '#hooks/mealPlan/useMealPlans';
import { useMealPlan } from '#hooks/mealPlan/useMealPlan';
import { useMealPlanItemActions } from '#hooks/mealPlan/useMealPlanItemActions';
import { useMealPlanCalendar } from '#hooks/mealPlan/useMealPlanCalendar';
import { useDailyMeals } from '#hooks/mealPlan/useDailyMeals';
import { useMealTemplateActions } from '#hooks/mealPlan/useMealTemplateActions';
import { useGenerateShoppingList } from '#hooks/mealPlan/useGenerateShoppingList';
import { useDuplicateMealPlan } from '#hooks/mealPlan/useDuplicateMealPlan';
import {
  useDeleteMealPlanMutation,
  GetMealPlansDocument,
  MealType,
  type MealTemplateDisplayFragment,
} from '#generated';
import { toastService } from '#/services/toastService';

const VIEW_OPTIONS = ['Week', 'Month'] as const;

export const MealPlanMain: React.FC = () => {
  const { profile } = useProfileData();
  const { theme } = useUnistyles();
  const unreadCount = useAppStore(state => state.unreadCount);
  const { navigate } = useAppNavigation();
  const addMealSheetRef = useRef<AddMealSheetRef>(null);

  // Template state
  const [saveTemplateVisible, setSaveTemplateVisible] = useState(false);
  const [templateBrowserVisible, setTemplateBrowserVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MealTemplateDisplayFragment | null>(null);
  const [templatePreviewVisible, setTemplatePreviewVisible] = useState(false);

  // Shopping list generation state
  const [shoppingListSheetVisible, setShoppingListSheetVisible] = useState(false);

  // Settings and duplicate state
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [duplicateVisible, setDuplicateVisible] = useState(false);

  const {
    createPlanFromTemplate,
    createTemplateFromPlan,
    creatingFromTemplate,
    creatingTemplate,
  } = useMealTemplateActions();

  // Fetch meal plans and auto-select current one
  const { currentPlan, mealPlans, loading: plansLoading } = useMealPlans();
  const activePlanId = currentPlan?.id ?? mealPlans[0]?.id ?? null;

  // Fetch the active plan with items
  const { mealPlan: activeMealPlan, items } = useMealPlan(activePlanId);

  // Calendar state
  const calendar = useMealPlanCalendar();

  // Daily meals for selected date
  const { dailyMeals, totalCalories, isEmpty } = useDailyMeals(
    items,
    calendar.selectedDate,
  );

  // Meal plan item actions
  const { createItem, toggleCompleted, deleteItem } =
    useMealPlanItemActions(activePlanId);

  // Shopping list generation
  const { generateShoppingList, loading: generatingShoppingList } =
    useGenerateShoppingList(activePlanId);

  // Duplicate meal plan
  const { duplicatePlan, loading: duplicatingPlan } = useDuplicateMealPlan();

  // Delete meal plan
  const [deletePlanMutation, { loading: deletingPlan }] = useDeleteMealPlanMutation({
    refetchQueries: [{ query: GetMealPlansDocument }],
    onError: error => {
      toastService.error(error.message || 'Failed to delete meal plan');
    },
  });

  // Compute days with meals for calendar indicators
  const daysWithMeals = useMemo(() => {
    const days = new Set<string>();
    items.forEach(item => {
      days.add(format(new Date(item.date), 'yyyy-MM-dd'));
    });
    return days;
  }, [items]);

  // Register add button - opens add meal sheet
  useTabBarAddButton(() => {
    addMealSheetRef.current?.open();
  });

  const handleToggleCompleted = useCallback(
    (id: string, isCompleted: boolean, hasRecipe: boolean) => {
      toggleCompleted(id, isCompleted, hasRecipe);
    },
    [toggleCompleted],
  );

  const handleDeleteItem = useCallback(
    (id: string) => {
      deleteItem(id);
    },
    [deleteItem],
  );

  const handleAddRecipe = useCallback(
    (recipeId: string, mealType: MealType) => {
      if (!activePlanId) return;
      createItem({
        mealPlanId: activePlanId,
        recipeId,
        mealType,
        date: calendar.selectedDate.toISOString(),
      });
    },
    [activePlanId, createItem, calendar.selectedDate],
  );

  const handleAddCustomMeal = useCallback(
    (name: string, mealType: MealType) => {
      if (!activePlanId) return;
      createItem({
        mealPlanId: activePlanId,
        customMealName: name,
        mealType,
        date: calendar.selectedDate.toISOString(),
      });
    },
    [activePlanId, createItem, calendar.selectedDate],
  );

  const handleOpenAddMeal = useCallback(
    (mealType?: MealType) => {
      addMealSheetRef.current?.open(mealType);
    },
    [],
  );

  const handleItemPress = useCallback(
    (item: any) => {
      if (item.recipe?.id) {
        navigate('RecipeDetail', { recipeId: item.recipe.id });
      }
    },
    [navigate],
  );

  const handleViewModeChange = useCallback(
    (value: string) => {
      calendar.setViewMode(value === 'Week' ? 'week' : 'month');
    },
    [calendar],
  );

  const handleCreatePlan = useCallback(() => {
    navigate('CreateMealPlan');
  }, [navigate]);

  const handleSaveAsTemplate = useCallback(() => {
    setSaveTemplateVisible(true);
  }, []);

  const handleSaveTemplate = useCallback(
    async (input: {
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
    },
    [createTemplateFromPlan],
  );

  const handleOpenTemplateBrowser = useCallback(() => {
    setTemplateBrowserVisible(true);
  }, []);

  const handleSelectTemplate = useCallback(
    (template: MealTemplateDisplayFragment) => {
      setSelectedTemplate(template);
      setTemplateBrowserVisible(false);
      setTemplatePreviewVisible(true);
    },
    [],
  );

  const handleCreateFromTemplate = useCallback(
    async (config: {
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
    },
    [createPlanFromTemplate],
  );

  const handleDuplicatePlan = useCallback(
    async (input: {
      mealPlanId: string;
      newName: string;
      newStartDate: string;
      newEndDate: string;
    }) => {
      const result = await duplicatePlan(input);
      if (result?.success) {
        setDuplicateVisible(false);
      }
    },
    [duplicatePlan],
  );

  const handleDeletePlan = useCallback(
    async (id: string) => {
      try {
        const result = await deletePlanMutation({ variables: { id } });
        if (result.data?.deleteMealPlan?.success) {
          toastService.success('Meal plan deleted');
        }
      } catch {
        // Error handled by onError callback
      }
    },
    [deletePlanMutation],
  );

  const handleGenerateShoppingList = useCallback(
    async (options: {
      checkPantry?: boolean;
      name?: string;
      shoppingListId?: string;
    }) => {
      const result = await generateShoppingList(options);
      if (result?.success) {
        setShoppingListSheetVisible(false);
      }
    },
    [generateShoppingList],
  );

  // Show empty state if no plans exist and not loading
  if (!plansLoading && mealPlans.length === 0) {
    return (
      <View style={styles.container} testID="meal-plan-screen">
        <TabScreenHeader
          label="Plan your meals"
          title="Meal Plan"
          avatarUrl={profile?.avatar}
          notificationCount={unreadCount}
          onAvatarPress={() => navigate('Profile')}
          onNotificationPress={() => navigate('Notifications')}
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
            title={currentPlan?.name ?? 'Meal Plan'}
            avatarUrl={profile?.avatar}
            notificationCount={unreadCount}
            onAvatarPress={() => navigate('Profile')}
            onNotificationPress={() => navigate('Notifications')}
          />
        </View>
        {!!activePlanId && (
          <View style={styles.headerActions}>
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

      {/* Week/Month toggle */}
      <View style={styles.segmentContainer}>
        <SegmentedControl
          options={VIEW_OPTIONS}
          value={calendar.viewMode === 'week' ? 'Week' : 'Month'}
          onChange={handleViewModeChange}
        />
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
        />
      ) : (
        <MonthCalendar
          selectedDate={calendar.selectedDate}
          onSelectDate={calendar.selectDate}
          daysWithMeals={daysWithMeals}
        />
      )}

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
      />

      {/* Add meal bottom sheet */}
      <AddMealSheet
        ref={addMealSheetRef}
        selectedDate={calendar.selectedDate}
        onAddRecipe={handleAddRecipe}
        onAddCustomMeal={handleAddCustomMeal}
      />

      {/* Save as Template Sheet */}
      <SaveAsTemplateSheet
        visible={saveTemplateVisible}
        mealPlanId={activePlanId}
        mealPlanName={currentPlan?.name}
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
      />

      {/* Settings Sheet */}
      <MealPlanSettingsSheet
        visible={settingsVisible}
        mealPlan={activeMealPlan}
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
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
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
  segmentContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
}));
