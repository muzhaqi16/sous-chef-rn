import React from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import Animated, {
  type useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { format } from 'date-fns';
import { Icon } from '#utils/iconUtils';
import { MealTypeSection } from './MealTypeSection';
import { EmptyDayState } from './EmptyDayState';
import type { MealTypeGroup } from '#hooks/mealPlan/useDailyMeals';
import type { MealType, MealPlanItemFragment } from '#generated';

interface DayMealListProps {
  selectedDate: Date;
  dailyMeals: MealTypeGroup[];
  totalCalories: number;
  isEmpty: boolean;
  onToggleCompleted?: (
    id: string,
    isCompleted: boolean,
    hasRecipe: boolean,
  ) => void;
  onItemPress?: (item: MealPlanItemFragment) => void;
  onDeleteItem?: (id: string) => void;
  onAddMeal?: (mealType?: MealType) => void;
  onScroll?: ReturnType<typeof useAnimatedScrollHandler>;
  listHeader?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export const DayMealList: React.FC<DayMealListProps> = ({
  selectedDate,
  dailyMeals,
  totalCalories,
  isEmpty,
  onToggleCompleted,
  onItemPress,
  onDeleteItem,
  onAddMeal,
  onScroll,
  listHeader,
  refreshing = false,
  onRefresh,
}) => {
  const { theme } = useUnistyles();

  return (
    <Animated.ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, isEmpty && styles.contentEmpty]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        ) : undefined
      }
    >
      {!!listHeader && listHeader}

      {isEmpty ? (
        <EmptyDayState selectedDate={selectedDate} onAddMeal={onAddMeal} />
      ) : (
        <>
          {/* Day summary */}
          <View style={styles.daySummary}>
            <Text style={styles.dateLabel}>
              {format(selectedDate, 'EEEE, MMMM d')}
            </Text>
            {totalCalories > 0 && (
              <Text style={styles.calorieLabel}>
                {Math.round(totalCalories)} cal
              </Text>
            )}
          </View>

          {/* Meal sections grouped by type */}
          {dailyMeals.map(group => (
            <MealTypeSection
              key={group.mealType}
              mealType={group.mealType}
              label={group.label}
              items={group.items}
              onToggleCompleted={onToggleCompleted}
              onItemPress={onItemPress}
              onDeleteItem={onDeleteItem}
              onAddMeal={
                onAddMeal ? () => onAddMeal(group.mealType) : undefined
              }
            />
          ))}

          {/* Add a meal button */}
          {!!onAddMeal && (
            <Pressable
              onPress={() => onAddMeal()}
              style={({ pressed }) => [
                styles.addMealButton,
                pressed && styles.pressed,
              ]}
            >
              <Icon
                name="add-circle-outline"
                size={20}
                color={styles.addMealIcon.color}
              />
              <Text style={styles.addMealText}>Add a meal</Text>
            </Pressable>
          )}
        </>
      )}
    </Animated.ScrollView>
  );
};

DayMealList.displayName = 'DayMealList';

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 120, // Account for tab bar
  },
  contentEmpty: {
    flexGrow: 1,
  },
  daySummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  dateLabel: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  calorieLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  addMealIcon: {
    color: theme.colors.primary,
  },
  addMealText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.primary,
  },
}));
