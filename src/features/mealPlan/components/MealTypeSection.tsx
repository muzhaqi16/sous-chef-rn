import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { MealPlanItemCard } from './MealPlanItemCard';
import { Text } from '#components/atoms/Text';
import { type MealType } from '#/graphql/generated/schemaTypes';
import { type MealPlanItemCard_ItemFragment } from './MealPlanItemCard.generated';
import { type SwipeableRef } from '#components/organisms/SwipeableItem/types';
import { useTranslation } from '#/i18n';

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
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  onSwipeableClose?: () => void;
}

export const MealTypeSection: React.FC<MealTypeSectionProps> = ({
  mealType,
  label,
  items,
  onToggleCompleted,
  onItemPress,
  onDeleteItem,
  onAddMeal,
  onSwipeableWillOpen,
  onSwipeableClose,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text role="bodyStrong">{label}</Text>
        {!!onAddMeal && (
          <Pressable
            onPress={() => onAddMeal(mealType)}
            accessibilityLabel={t('labels.addNamed', { name: label })}
            style={styles.addButton}
            hitSlop={8}
          >
            <Icon name="add" size={20} tone="primary" />
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
          onSwipeableWillOpen={onSwipeableWillOpen}
          onSwipeableClose={onSwipeableClose}
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
}));
