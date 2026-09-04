import React from 'react';
import { useTranslation } from '#/i18n';
import { ScrollView } from 'react-native-gesture-handler';
import { ThemedRefreshControl } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { MealTypeSection } from './MealTypeSection';
import { EmptyDayState } from './EmptyDayState';
import { Text } from '#components/atoms/Text';
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
  const { t } = useTranslation();
  // Ensure only one row's swipe-to-delete is open at a time across all sections.
  const { handleSwipeableWillOpen, handleSwipeableClose } =
    useSwipeableCoordinator();
  return (
    <ScrollView
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

          {/* Add a meal button */}
          {!!onAddMeal && (
            <AppPressable
              onPress={() => onAddMeal()}
              style={styles.addMealButton}
            >
              <Icon name="add-circle-outline" size={20} tone="primary" />
              <Text role="bodyStrong" tone="accent" style={styles.addMealText}>
                {t('labels.addAMeal')}
              </Text>
            </AppPressable>
          )}
        </>
      )}
    </ScrollView>
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
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  addMealText: {
    marginLeft: theme.spacing.sm,
  },
}));
