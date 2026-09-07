import React from 'react';
import { SwipeAwareScrollComponent } from '#components/atoms/SwipeAwareScrollComponent';
import { ThemedRefreshControl } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { MealTypeSection } from './MealTypeSection';
import { EmptyDayState } from './EmptyDayState';
import { useSwipeableCoordinator } from '#hooks/ui/useSwipeableCoordinator';
import type { MealTypeGroup } from '#features/mealPlan/hooks/useDailyMeals';
import { type MealType } from '#/graphql/generated/schemaTypes';

interface DayMealListProps {
  selectedDate: Date;
  dailyMeals: MealTypeGroup[];
  isEmpty: boolean;
  onToggleCompleted?: (
    id: string,
    isCompleted: boolean,
    hasRecipe: boolean,
  ) => void;
  onItemPress?: (id: string) => void;
  onDeleteItem?: (id: string) => void;
  onAddMeal?: (mealType?: MealType) => void;
  listHeader?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export const DayMealList: React.FC<DayMealListProps> = ({
  selectedDate,
  dailyMeals,
  isEmpty,
  onToggleCompleted,
  onItemPress,
  onDeleteItem,
  onAddMeal,
  listHeader,
  refreshing = false,
  onRefresh,
}) => {
  // Ensure only one row's swipe-to-delete is open at a time across all sections.
  const { handleSwipeableWillOpen, handleSwipeableClose } =
    useSwipeableCoordinator();
  return (
    <SwipeAwareScrollComponent
      style={styles.container}
      contentContainerStyle={[styles.content, isEmpty && styles.contentEmpty]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      {!!listHeader && listHeader}
      {isEmpty ? (
        <EmptyDayState selectedDate={selectedDate} onAddMeal={onAddMeal} />
      ) : (
        <>
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
              onSwipeableWillOpen={handleSwipeableWillOpen}
              onSwipeableClose={handleSwipeableClose}
            />
          ))}
        </>
      )}
    </SwipeAwareScrollComponent>
  );
};

DayMealList.displayName = 'DayMealList';

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  content: {
    // The list owns the gutter for everything it renders, rows included.
    paddingHorizontal: theme.layout.pageGutter,
    paddingBottom: 120, // Account for tab bar
  },
  contentEmpty: {
    flexGrow: 1,
  },
}));
