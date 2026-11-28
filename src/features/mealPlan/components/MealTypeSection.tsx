import React from 'react';
import { IconButton } from '#components/atoms/IconButton';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { MealPlanItemCard } from '#features/mealPlan/ui/MealPlanItemCard';
import { Text } from '#components/atoms/Text';
import type { MealType } from '#graphql/generated/schemaTypes';
import type { FragmentType } from '@apollo/client/masking';
import type { MealPlanItemCard_ItemFragmentDoc } from '#features/mealPlan/ui/MealPlanItemCard.generated';
import type { SwipeableRef } from '#components/organisms/SwipeableItem/types';
import { useTranslation } from '#i18n';

/** A plan's item as its query holds it; the card reads its fields. */
export type MealPlanItemRef = FragmentType<
  typeof MealPlanItemCard_ItemFragmentDoc
> & { id: string };

interface MealTypeSectionProps {
  mealType: MealType;
  label: string;
  items: MealPlanItemRef[];
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
          <IconButton
            name="add"
            size="sm"
            tone="primary"
            onPress={() => onAddMeal(mealType)}
            accessibilityLabel={t('labels.addNamed', { name: label })}
          />
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
}));
