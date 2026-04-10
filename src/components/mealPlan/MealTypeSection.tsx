import React from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { MealPlanItemCard } from './MealPlanItemCard';
import type { MealType, MealPlanItemFragment } from '#generated';

interface MealTypeSectionProps {
  mealType: MealType;
  label: string;
  items: MealPlanItemFragment[];
  onToggleCompleted?: (
    id: string,
    isCompleted: boolean,
    hasRecipe: boolean,
  ) => void;
  onItemPress?: (item: MealPlanItemFragment) => void;
  onDeleteItem?: (id: string) => void;
  onAddMeal?: (mealType: MealType) => void;
}

export const MealTypeSection: React.FC<MealTypeSectionProps> = ({
  mealType,
  label,
  items,
  onToggleCompleted,
  onItemPress,
  onDeleteItem,
  onAddMeal,
}) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {!!onAddMeal && (
          <Pressable
            onPress={() => onAddMeal(mealType)}
            style={styles.addButton}
            hitSlop={8}
          >
            <Icon name="add" size={20} color={styles.addIcon.color} />
          </Pressable>
        )}
      </View>

      {items.map(item => (
        <MealPlanItemCard
          key={item.id}
          item={item}
          onToggleCompleted={onToggleCompleted}
          onPress={onItemPress}
          onDelete={onDeleteItem}
        />
      ))}
    </View>
  );
};

MealTypeSection.displayName = 'MealTypeSection';

const styles = StyleSheet.create(theme => ({
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  addButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
  },
  addIcon: {
    color: theme.colors.primary,
  },
}));
