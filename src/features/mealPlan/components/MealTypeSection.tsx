import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { MealPlanItemCard } from './MealPlanItemCard';
import { Text } from '#components/atoms/Text';
import { type MealType } from '#/graphql/generated/schemaTypes';
import { type MealPlanItemCard_ItemFragment } from './MealPlanItemCard.generated';

interface MealTypeSectionProps {
  mealType: MealType;
  label: string;
  items: MealPlanItemCard_ItemFragment[];
  onToggleCompleted?: (
    id: string,
    isCompleted: boolean,
    hasRecipe: boolean,
  ) => void;
  onItemPress?: (id: string) => void;
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
        <Text size="md" weight="semibold">
          {label}
        </Text>
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
  addButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
  },
  addIcon: {
    color: theme.colors.primary,
  },
}));
